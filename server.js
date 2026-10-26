const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve base directory (robust for local run and Vercel serverless)
const basePath = fs.existsSync(path.join(process.cwd(), 'data', 'siteData.json')) 
  ? process.cwd() 
  : __dirname;

// Load Data
const siteData = JSON.parse(fs.readFileSync(path.join(basePath, 'data', 'siteData.json'), 'utf-8'));
const products = JSON.parse(fs.readFileSync(path.join(basePath, 'data', 'products.json'), 'utf-8'));
const galleryData = JSON.parse(fs.readFileSync(path.join(basePath, 'data', 'gallery.json'), 'utf-8'));

// High-speed compression
app.use(compression({
  threshold: 1024,
  level: 6
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache static files (images, css, js) for blazing fast repeat loads
app.use(express.static(path.join(basePath, 'public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// View engine setup
app.set('views', path.join(basePath, 'views'));
app.set('view engine', 'ejs');

// Global view locals
app.use((req, res, next) => {
  res.locals.site = siteData;
  res.locals.currentPath = req.path.replace(/\/+$/, '') || '/';
  res.locals.products = products;
  next();
});

// Remove trailing slashes for standard SEO, but handle both cleanly
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const query = req.url.slice(req.path.length);
    const safePath = req.path.slice(0, -1);
    return res.redirect(301, safePath + query);
  }
  next();
});

// --- Routes ---

// Home Page
app.get('/', (req, res) => {
  const featuredProducts = products.filter(p => p.featured).slice(0, 8);
  const heroSliderProducts = [
    { title: "Naida V90 UP", slug: "naida-v90-up", img: "/images/phonak-naida-bte-digital-hearing-aid-uttara-bangladesh.png" },
    { title: "Phonak CIC", slug: "hearing-aid-phonak-cic-2", img: "/images/phonak-cic-invisible-in-canal-hearing-aid-dhaka-bangladesh.jpeg" },
    { title: "Rexton Hearing Aid", slug: "rexton-hearing-aid", img: "/images/rexton-arena-hearing-aid-uttara-bangladesh.webp" },
    { title: "Unitron Hearing Aid", slug: "hearing-aid-unitron", img: "/images/unitron-digital-bte-hearing-aid-uttara-dhaka.webp" },
    { title: "Phonak Naida L 30 UP", slug: "phonak-naida-l-30-up-2", img: "/images/phonak-naida-l30-up-lumity-hearing-aid-dhaka.webp" },
    { title: "Phonak Sky", slug: "phonak-sky", img: "/images/phonak-sky-children-hearing-aid-dhaka-bangladesh.webp" },
    { title: "Phonak Naida Q 70 UP", slug: "phonak-naida-q-50-up", img: "/images/phonak-naida-q70-hearing-aid-uttara-bangladesh.jpg" },
    { title: "Phonak Naida V50 UP", slug: "phonak-naida-b50-up", img: "/images/phonak-naida-bte-digital-hearing-aid-uttara-bangladesh.png" },
    { title: "Naida B 50 UP", slug: "naida-b-50-up", img: "/images/phonak-naida-bte-digital-hearing-aid-uttara-bangladesh.png" },
    { title: "Phonak Naida V 70 SP", slug: "phonak-naida-v-70-sp", img: "/images/phonak-naida-v70-bte-hearing-aid-gazipur-bangladesh.jpg" },
    { title: "Naida V 70 UP", slug: "naida-v-70-up", img: "/images/phonak-naida-v70-bte-hearing-aid-gazipur-bangladesh.jpg" },
    { title: "Cleaning and Care", slug: "cleaning-and-care", img: "/images/hearing-aid-repair-service-uttara-gazipur-bangladesh.jpg" },
    { title: "Terra SP", slug: "terra-sp", img: "/images/phonak-terra-sp-hearing-aid-uttara-dhaka.webp" },
    { title: "Phonak Infinio", slug: "phonak-infinio", img: "/images/phonak-infinio-ai-digital-hearing-aid-bangladesh.jpeg" },
    { title: "Terra UP", slug: "phonak-terra-up", img: "/images/phonak-terra-up-hearing-aid-gazipur-bangladesh.webp" },
    { title: "Rexton CIC", slug: "hearing-aid-rexton-cic", img: "/images/rexton-cic-hearing-aid-gazipur-uttara-bangladesh.jpg" }
  ];

  res.render('index', {
    pageTitle: 'Micro Hearing Aid Centre – Hearing means quality of life – Make better living',
    metaDescription: 'Micro Hearing Care Centre (MHCC) Bangladesh - Leading audiology testing, digital hearing aid fitting, custom earmoulds and repair services in Uttara & Gazipur since 2014.',
    featuredProducts,
    heroSliderProducts
  });
});

// Products Catalog
app.get('/products', (req, res) => {
  const { brand, type, search } = req.query;
  let filtered = [...products];

  if (brand && brand !== 'All') {
    filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }
  if (type && type !== 'All') {
    filtered = filtered.filter(p => p.type.toLowerCase() === type.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
  }

  const brands = ['All', ...new Set(products.map(p => p.brand))];
  const types = ['All', ...new Set(products.map(p => p.type))];

  res.render('products', {
    pageTitle: 'Hearing Aid Products – Micro Hearing Aid Centre Bangladesh',
    metaDescription: 'Browse Phonak, Rexton, Unitron digital hearing aids, rechargeable models, CIC invisible hearing aids, pediatric care kits and accessories at Micro Hearing Aid Centre.',
    filteredProducts: filtered,
    brands,
    types,
    selectedBrand: brand || 'All',
    selectedType: type || 'All',
    searchQuery: search || ''
  });
});

// Product Detail Page
app.get('/product/:slug', (req, res) => {
  const product = products.find(p => p.slug === req.params.slug);
  if (!product) {
    return res.status(404).render('404', {
      pageTitle: 'Product Not Found – Micro Hearing Aid Centre'
    });
  }

  const related = products
    .filter(p => p.brand === product.brand && p.slug !== product.slug)
    .slice(0, 4);

  res.render('product-detail', {
    pageTitle: `${product.title} – Micro Hearing Aid Centre`,
    metaDescription: `Buy ${product.title} in Bangladesh from Micro Hearing Care Centre. Certified audiologist fitting, 5-year servicing, best price guaranteed.`,
    product,
    related
  });
});

// Services Page
app.get('/services', (req, res) => {
  res.render('services', {
    pageTitle: 'Hearing Services & Diagnostics – Micro Hearing Aid Centre',
    metaDescription: 'Comprehensive clinical audiology services in Dhaka & Gazipur: Pure tone audiometry, tympanometry, custom earmould fabrication, hearing aid servicing & tinnitus care.'
  });
});

// Hearing Aids Overview
app.get('/hearing-aids', (req, res) => {
  res.render('hearing-aids', {
    pageTitle: 'Modern Hearing Aids – Micro Hearing Aid Centre',
    metaDescription: 'Discover advanced digital hearing aids: crystal-clear audio, intelligent background noise filtering, Bluetooth streaming and invisible designs for all ages in Bangladesh.'
  });
});

// Hearing Aids Style
app.get('/hearing-aids-style', (req, res) => {
  res.render('hearing-aids-style', {
    pageTitle: 'Hearing Aid Styles & Types (IIC, CIC, RIC, BTE) – Micro Hearing Aid Centre',
    metaDescription: 'Compare invisible in canal (IIC), completely in canal (CIC), receiver in canal (RIC) and behind the ear (BTE) hearing aid styles to find your perfect fit.'
  });
});

// How do Hearing Aids Work
app.get('/how-do-hearing-aid-work', (req, res) => {
  res.render('how-do-hearing-aid-work', {
    pageTitle: 'How Do Hearing Aids Work? – Audiology Guide – Micro Hearing Aid Centre',
    metaDescription: 'Understand how modern digital hearing aids capture sound, process audio frequencies with DSP computer chips, and deliver crisp speech clarity directly to your brain.'
  });
});

// Hearing Aid Brands in Bangladesh
app.get('/hearing-aid-brand-in-bangladesh', (req, res) => {
  res.render('hearing-aid-brand', {
    pageTitle: 'Hearing Aid Brands in Bangladesh – Phonak, Rexton, Unitron – Micro Hearing Aid Centre',
    metaDescription: 'Explore world-leading hearing aid brands in Bangladesh: Phonak Switzerland, Rexton Germany, Unitron Canada, Signia and Widex with official MHCC warranty.'
  });
});

// Humanitarian Works
app.get('/humanitarian-works', (req, res) => {
  res.render('humanitarian', {
    pageTitle: 'Humanitarian Works – Free Hearing Aids for Deaf People – Micro Hearing Aid Centre',
    metaDescription: 'MHCC humanitarian program providing free hearing aids to deaf and underprivileged individuals across Bangladesh through five trusted disability welfare organisations.'
  });
});

// Our Mission
app.get('/our-mission', (req, res) => {
  res.render('mission', {
    pageTitle: 'Our Mission: Hearing Care in All 64 Districts – Micro Hearing Aid Centre',
    metaDescription: 'Our vision: establishing comprehensive hearing care centres in all 64 districts of Bangladesh to ensure no one suffers from untreated hearing loss.'
  });
});

// Hearing Aid Area of Activities
app.get('/hearing-aid-area-of-activities', (req, res) => {
  res.render('activities', {
    pageTitle: 'Hearing Aid Area of Activities – Micro Hearing Aid Centre',
    metaDescription: 'Hearing aids designed for every moment of your lifestyle: quiet conversations, busy social settings, workplace meetings, outdoor activities and television watching.'
  });
});

// Blog
app.get('/blog', (req, res) => {
  res.render('blog', {
    pageTitle: 'Blog & Ear Care Insights – Micro Hearing Aid Centre',
    metaDescription: 'Read informative articles on hearing loss prevention, audiological health, hearing aid maintenance tips and technological advancements.'
  });
});

// Photo Gallery
app.get('/gallery', (req, res) => res.redirect(301, '/photo-gallery'));
app.get('/photo-gallery', (req, res) => {
  const { category } = req.query;
  const categories = ['All', ...new Set(galleryData.map(g => g.category))];
  const items = (category && category !== 'All')
    ? galleryData.filter(g => g.category.toLowerCase() === category.toLowerCase())
    : galleryData;

  res.render('gallery', {
    pageTitle: 'Photo Gallery – Micro Hearing Care Centre Bangladesh',
    metaDescription: 'Browse the photo gallery of Micro Hearing Care Centre. View clinic facilities in Uttara & Gazipur, audiology diagnostics, hearing aid fitting and community events.',
    galleryItems: items,
    categories,
    selectedCategory: category || 'All'
  });
});

// Contact Us
app.get('/contact', (req, res) => res.redirect(301, '/contact-us'));
app.get('/contact-us', (req, res) => {
  res.render('contact', {
    pageTitle: 'Contact Us & Clinic Locations (Uttara & Gazipur) – Micro Hearing Aid Centre',
    metaDescription: 'Get in touch with Micro Hearing Care Centre. Book an appointment at our Uttara Head Office or Gazipur Branch. 24/7 Helpline: 01787 51 999 5.'
  });
});

// --- API Endpoints ---
app.get('/api/products', (req, res) => {
  res.json(products);
});

app.get('/api/gallery', (req, res) => {
  res.json(galleryData);
});

// Interactive appointment booking endpoint
app.post('/api/appointment', (req, res) => {
  const { name, phone, branch, preferredDate, message } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone number are required.' });
  }

  // In production, send SMS / Email notification or save to database
  console.log('New Appointment Request Received:', { name, phone, branch, preferredDate, message, timestamp: new Date() });

  return res.json({
    success: true,
    message: 'Thank you! Your appointment request has been received. Our audiology team will contact you shortly to confirm.'
  });
});

// SEO Sitemap
app.get('/sitemap.xml', (req, res) => {
  const urls = [
    '/',
    '/hearing-aids',
    '/hearing-aids-style',
    '/how-do-hearing-aid-work',
    '/hearing-aid-brand-in-bangladesh',
    '/products',
    '/services',
    '/humanitarian-works',
    '/our-mission',
    '/hearing-aid-area-of-activities',
    '/blog',
    '/contact-us'
  ];

  products.forEach(p => urls.push(`/product/${p.slug}`));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>https://microhearingaidbd.com${u}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${u === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${u === '/' ? '1.0' : u === '/products' || u === '/services' || u === '/contact-us' ? '0.8' : '0.6'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: https://microhearingaidbd.com/sitemap.xml`);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', {
    pageTitle: 'Page Not Found – Micro Hearing Aid Centre'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Server Error. Please refresh or try again later.');
});

// Start Server (when run directly with node server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Micro Hearing Aid BD Node.js Server running on port ${PORT}`);
    console.log(`⚡ Speed: Ultra-fast in-memory SSR with Brotli/Gzip & local caching`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

// Export for Vercel Serverless Function
module.exports = app;

