const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { contentStore, slugify } = require('../data/contentStore');

const router = express.Router();

// Configuration
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'micro2026!';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'mhcc_super_secret_admin_key_uttara_2026';
const COOKIE_NAME = 'mhcc_admin_token';

// Base path resolution for local run and Vercel serverless
const basePath = fs.existsSync(path.join(process.cwd(), 'public'))
  ? process.cwd()
  : path.join(__dirname, '..');
const UPLOAD_DIR = path.join(basePath, 'public', 'images', 'cms');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  // Gracefully ignored in read-only environments
}

// In-memory multer storage: works seamlessly across local, serverless (Vercel), and containers
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file || !file.originalname) {
      return cb(null, true);
    }
    const allowedExt = /jpeg|jpg|png|webp|svg|gif|avif|bmp|jfif|heic|heif|tiff/i;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype || '';
    if (mime.startsWith('image/') || allowedExt.test(ext) || allowedExt.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP, SVG, GIF, AVIF, BMP, JFIF) are allowed'));
    }
  }
});

// Helper to save uploaded file: writes to static disk when writable, falls back to Data URI if read-only
function saveUploadedFile(file) {
  if (!file || !file.buffer || file.buffer.length === 0) return null;
  const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'image';
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
  const filename = `mhcc-${base}-${uniqueSuffix}${ext}`;
  const diskPath = path.join(UPLOAD_DIR, filename);

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    fs.writeFileSync(diskPath, file.buffer);
    return `/images/cms/${filename}`;
  } catch (fsErr) {
    console.warn('[CMS Upload] File system write unavailable, using Base64 Data URL fallback:', fsErr.message);
    const mime = file.mimetype || 'image/jpeg';
    return `data:${mime};base64,${file.buffer.toString('base64')}`;
  }
}

// Multer error-handling middleware wrapper
function handleUpload(fieldName, getRedirectUrl) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error(`[Upload Error on ${req.originalUrl}]:`, err);
        const errorMsg = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image file is too large (maximum size is 15MB).'
          : (err.message || 'Error processing uploaded file.');
        const redirectUrl = typeof getRedirectUrl === 'function' ? getRedirectUrl(req) : getRedirectUrl;
        return res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMsg)}`);
      }
      next();
    });
  };
}

// Helper: Token Generation & Verification
function createToken(username) {
  const payload = `${username}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifyToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [username, timestamp, hmac] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${username}:${timestamp}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      // 7 days expiration
      const age = Date.now() - Number(timestamp);
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return { username };
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Auth Middleware
function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const user = verifyToken(token);
  if (!user) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please login.' });
    }
    return res.redirect(`/admin/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  req.adminUser = user;
  res.locals.adminUser = user;
  next();
}

// Global locals for admin layout
router.use((req, res, next) => {
  res.locals.adminBaseUrl = '/admin';
  res.locals.flash = {
    success: req.query.success || null,
    error: req.query.error || null
  };
  next();
});

// --- AUTH ROUTES ---

// Login Page
router.get('/login', (req, res) => {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (verifyToken(token)) {
    return res.redirect('/admin');
  }
  res.render('admin/login', {
    pageTitle: 'Admin Login – Micro Hearing Care Centre CMS',
    redirect: req.query.redirect || '/admin',
    error: req.query.error || null
  });
});

// Login Handler
router.post('/login', (req, res) => {
  const { username, password, redirect } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = createToken(username);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });
    return res.redirect(redirect || '/admin');
  }
  res.render('admin/login', {
    pageTitle: 'Admin Login – Micro Hearing Care Centre CMS',
    redirect: redirect || '/admin',
    error: 'Invalid username or password. Please try again.'
  });
});

// Logout Handler
router.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/admin/login?msg=logged_out');
});

// All subsequent routes require admin authentication
router.use(requireAdmin);

// --- DASHBOARD ROUTE ---
router.get(['/', '/dashboard'], (req, res) => {
  const stats = contentStore.getStats();
  const recentProducts = contentStore.getProducts().slice(0, 6);
  const recentBlogs = contentStore.getBlogs().slice(0, 5);

  res.render('admin/dashboard', {
    pageTitle: 'Admin Dashboard – Micro Hearing CMS',
    activeNav: 'dashboard',
    stats,
    recentProducts,
    recentBlogs
  });
});

// --- PRODUCT ROUTES ---

// List Products
router.get('/products', (req, res) => {
  const { search, brand, type, stock } = req.query;
  let products = [...contentStore.getProducts()];

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.type && p.type.toLowerCase().includes(q))
    );
  }

  if (brand && brand !== 'All') {
    products = products.filter(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (type && type !== 'All') {
    products = products.filter(p => p.type && p.type.toLowerCase() === type.toLowerCase());
  }

  if (stock === 'in') {
    products = products.filter(p => p.inStock);
  } else if (stock === 'out') {
    products = products.filter(p => !p.inStock);
  }

  const stats = contentStore.getStats();

  res.render('admin/products', {
    pageTitle: 'Products Management – Micro Hearing CMS',
    activeNav: 'products',
    products,
    brands: ['All', ...stats.brandsList],
    types: ['All', ...stats.typesList],
    selectedBrand: brand || 'All',
    selectedType: type || 'All',
    selectedStock: stock || 'all',
    searchQuery: search || ''
  });
});

// New Product Form
router.get('/products/new', (req, res) => {
  const stats = contentStore.getStats();
  res.render('admin/product-form', {
    pageTitle: 'Add New Product – Micro Hearing CMS',
    activeNav: 'products',
    isEdit: false,
    product: {
      id: '',
      title: '',
      slug: '',
      brand: 'Phonak',
      type: 'Behind-the-Ear (BTE)',
      image: '',
      originalUrl: '',
      featured: false,
      inStock: true,
      description: ''
    },
    brands: stats.brandsList,
    types: stats.typesList
  });
});

// Create Product Handler
router.post('/products/new', handleUpload('imageFile', '/admin/products/new'), (req, res) => {
  try {
    const { title, slug, brand, customBrand, type, customType, originalUrl, featured, inStock, description, imageUrl } = req.body;

    if (!title || !title.trim()) {
      return res.redirect('/admin/products/new?error=' + encodeURIComponent('Product Title is required.'));
    }

    let imagePath = imageUrl && imageUrl.trim() ? imageUrl.trim() : '/images/micro-rexton-hearing-aid-batteries-dhaka-bangladesh.webp';
    if (req.file) {
      const saved = saveUploadedFile(req.file);
      if (saved) imagePath = saved;
    }

    const finalBrand = brand === '__custom__' && customBrand ? customBrand.trim() : (brand || 'Micro Hearing');
    const finalType = type === '__custom__' && customType ? customType.trim() : (type || 'Behind-the-Ear (BTE)');

    const newProduct = contentStore.createProduct({
      title: title.trim(),
      slug: slug ? slug.trim() : '',
      brand: finalBrand,
      type: finalType,
      image: imagePath,
      originalUrl: originalUrl ? originalUrl.trim() : '',
      featured: featured === 'on' || featured === 'true' || featured === true,
      inStock: inStock === 'on' || inStock === 'true' || inStock === true,
      description: description ? description.trim() : ''
    });

    res.redirect(`/admin/products?success=${encodeURIComponent(`Product "${newProduct.title}" created successfully!`)}`);
  } catch (err) {
    console.error('Error creating product:', err);
    res.redirect(`/admin/products/new?error=${encodeURIComponent(err.message || 'Failed to create product')}`);
  }
});

// Edit Product Form
router.get('/products/edit/:id', (req, res) => {
  const product = contentStore.getProductById(req.params.id);
  if (!product) {
    return res.redirect(`/admin/products?error=${encodeURIComponent('Product not found')}`);
  }

  const stats = contentStore.getStats();
  res.render('admin/product-form', {
    pageTitle: `Edit Product: ${product.title} – Micro Hearing CMS`,
    activeNav: 'products',
    isEdit: true,
    product,
    brands: stats.brandsList,
    types: stats.typesList
  });
});

// Update Product Handler
router.post('/products/edit/:id', handleUpload('imageFile', (req) => `/admin/products/edit/${req.params.id}`), (req, res) => {
  try {
    const { title, slug, brand, customBrand, type, customType, originalUrl, featured, inStock, description, imageUrl } = req.body;

    const existing = contentStore.getProductById(req.params.id);
    if (!existing) {
      return res.redirect(`/admin/products?error=${encodeURIComponent('Product not found')}`);
    }

    if (!title || !title.trim()) {
      return res.redirect(`/admin/products/edit/${req.params.id}?error=${encodeURIComponent('Product Title is required.')}`);
    }

    let imagePath = existing.image;
    if (req.file) {
      const saved = saveUploadedFile(req.file);
      if (saved) imagePath = saved;
    } else if (imageUrl && imageUrl.trim()) {
      imagePath = imageUrl.trim();
    }

    const finalBrand = brand === '__custom__' && customBrand ? customBrand.trim() : (brand || existing.brand);
    const finalType = type === '__custom__' && customType ? customType.trim() : (type || existing.type);

    const updated = contentStore.updateProduct(req.params.id, {
      title: title.trim(),
      slug: slug ? slug.trim() : existing.slug,
      brand: finalBrand,
      type: finalType,
      image: imagePath,
      originalUrl: originalUrl ? originalUrl.trim() : '',
      featured: featured === 'on' || featured === 'true' || featured === true,
      inStock: inStock === 'on' || inStock === 'true' || inStock === true,
      description: description ? description.trim() : ''
    });

    res.redirect(`/admin/products?success=${encodeURIComponent(`Product "${updated.title}" updated successfully!`)}`);
  } catch (err) {
    console.error('Error updating product:', err);
    res.redirect(`/admin/products/edit/${req.params.id}?error=${encodeURIComponent(err.message || 'Failed to update product')}`);
  }
});

// Delete Product Handler
router.post('/products/delete/:id', (req, res) => {
  const product = contentStore.getProductById(req.params.id);
  const title = product ? product.title : 'Product';
  const deleted = contentStore.deleteProduct(req.params.id);

  if (deleted) {
    res.redirect(`/admin/products?success=${encodeURIComponent(`Product "${title}" was permanently removed.`)}`);
  } else {
    res.redirect(`/admin/products?error=${encodeURIComponent('Could not delete product or item not found.')}`);
  }
});

// --- BLOG ROUTES ---

// List Blogs
router.get('/blogs', (req, res) => {
  const { search, category } = req.query;
  let blogs = [...contentStore.getBlogs()];

  if (search) {
    const q = search.toLowerCase();
    blogs = blogs.filter(b =>
      (b.title && b.title.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q)) ||
      (b.excerpt && b.excerpt.toLowerCase().includes(q))
    );
  }

  if (category && category !== 'All') {
    blogs = blogs.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
  }

  const stats = contentStore.getStats();

  res.render('admin/blogs', {
    pageTitle: 'Blog Posts Management – Micro Hearing CMS',
    activeNav: 'blogs',
    blogs,
    categories: ['All', ...stats.categoriesList],
    selectedCategory: category || 'All',
    searchQuery: search || ''
  });
});

// New Blog Post Form
router.get('/blogs/new', (req, res) => {
  const stats = contentStore.getStats();
  res.render('admin/blog-form', {
    pageTitle: 'Write New Blog Article – Micro Hearing CMS',
    activeNav: 'blogs',
    isEdit: false,
    blog: {
      id: '',
      title: '',
      slug: '',
      category: 'General Audiology',
      author: 'Dr. Audiology Team, MHCC',
      readTime: '4 min read',
      image: '',
      excerpt: '',
      content: '',
      featured: false,
      published: true
    },
    categories: stats.categoriesList
  });
});

// Create Blog Post Handler
router.post('/blogs/new', handleUpload('imageFile', '/admin/blogs/new'), (req, res) => {
  try {
    const { title, slug, category, customCategory, author, readTime, excerpt, content, featured, published, imageUrl } = req.body;

    if (!title || !title.trim()) {
      return res.redirect('/admin/blogs/new?error=' + encodeURIComponent('Article Title is required.'));
    }

    let imagePath = imageUrl && imageUrl.trim() ? imageUrl.trim() : '/images/micro-audiologist-hearing-aid-fitting-uttara-bangladesh.jpg';
    if (req.file) {
      const saved = saveUploadedFile(req.file);
      if (saved) imagePath = saved;
    }

    const finalCategory = category === '__custom__' && customCategory ? customCategory.trim() : (category || 'General Audiology');

    const newBlog = contentStore.createBlog({
      title: title.trim(),
      slug: slug ? slug.trim() : '',
      category: finalCategory,
      author: author ? author.trim() : 'Dr. Audiology Team, MHCC',
      readTime: readTime ? readTime.trim() : '',
      image: imagePath,
      excerpt: excerpt ? excerpt.trim() : '',
      content: content ? content.trim() : '<p>Write your article here...</p>',
      featured: featured === 'on' || featured === 'true' || featured === true,
      published: published === 'on' || published === 'true' || published === true
    });

    res.redirect(`/admin/blogs?success=${encodeURIComponent(`Blog article "${newBlog.title}" published successfully!`)}`);
  } catch (err) {
    console.error('Error creating blog post:', err);
    res.redirect(`/admin/blogs/new?error=${encodeURIComponent(err.message || 'Failed to create blog article')}`);
  }
});

// Edit Blog Post Form
router.get('/blogs/edit/:id', (req, res) => {
  const blog = contentStore.getBlogById(req.params.id);
  if (!blog) {
    return res.redirect(`/admin/blogs?error=${encodeURIComponent('Blog post not found')}`);
  }

  const stats = contentStore.getStats();
  res.render('admin/blog-form', {
    pageTitle: `Edit Blog: ${blog.title} – Micro Hearing CMS`,
    activeNav: 'blogs',
    isEdit: true,
    blog,
    categories: stats.categoriesList
  });
});

// Update Blog Post Handler
router.post('/blogs/edit/:id', handleUpload('imageFile', (req) => `/admin/blogs/edit/${req.params.id}`), (req, res) => {
  try {
    const { title, slug, category, customCategory, author, date, readTime, excerpt, content, featured, published, imageUrl } = req.body;

    const existing = contentStore.getBlogById(req.params.id);
    if (!existing) {
      return res.redirect(`/admin/blogs?error=${encodeURIComponent('Blog post not found')}`);
    }

    if (!title || !title.trim()) {
      return res.redirect(`/admin/blogs/edit/${req.params.id}?error=${encodeURIComponent('Article Title is required.')}`);
    }

    let imagePath = existing.image;
    if (req.file) {
      const saved = saveUploadedFile(req.file);
      if (saved) imagePath = saved;
    } else if (imageUrl && imageUrl.trim()) {
      imagePath = imageUrl.trim();
    }

    const finalCategory = category === '__custom__' && customCategory ? customCategory.trim() : (category || existing.category);

    const updated = contentStore.updateBlog(req.params.id, {
      title: title.trim(),
      slug: slug ? slug.trim() : existing.slug,
      category: finalCategory,
      author: author ? author.trim() : existing.author,
      date: date ? date.trim() : existing.date,
      readTime: readTime ? readTime.trim() : existing.readTime,
      image: imagePath,
      excerpt: excerpt ? excerpt.trim() : existing.excerpt,
      content: content ? content.trim() : existing.content,
      featured: featured === 'on' || featured === 'true' || featured === true,
      published: published === 'on' || published === 'true' || published === true
    });

    res.redirect(`/admin/blogs?success=${encodeURIComponent(`Blog post "${updated.title}" updated successfully!`)}`);
  } catch (err) {
    console.error('Error updating blog post:', err);
    res.redirect(`/admin/blogs/edit/${req.params.id}?error=${encodeURIComponent(err.message || 'Failed to update blog post')}`);
  }
});

// Delete Blog Post Handler
router.post('/blogs/delete/:id', (req, res) => {
  const blog = contentStore.getBlogById(req.params.id);
  const title = blog ? blog.title : 'Article';
  const deleted = contentStore.deleteBlog(req.params.id);

  if (deleted) {
    res.redirect(`/admin/blogs?success=${encodeURIComponent(`Blog post "${title}" was permanently removed.`)}`);
  } else {
    res.redirect(`/admin/blogs?error=${encodeURIComponent('Could not delete blog post or item not found.')}`);
  }
});

// --- ASYNC API ENDPOINTS FOR CMS ---
router.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    const url = saveUploadedFile(req.file);
    return res.json({
      success: true,
      url,
      filename: req.file.originalname,
      size: req.file.size
    });
  });
});

module.exports = router;
