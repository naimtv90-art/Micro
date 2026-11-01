const fs = require('fs');
const path = require('path');
const os = require('os');

// Robust base directory resolution for local development and Vercel serverless
const basePath = fs.existsSync(path.join(process.cwd(), 'data', 'siteData.json'))
  ? process.cwd()
  : path.join(__dirname, '..');

const LOCAL_PRODUCTS_FILE = path.join(basePath, 'data', 'products.json');
const LOCAL_BLOGS_FILE = path.join(basePath, 'data', 'blogs.json');
const LOCAL_APPOINTMENTS_FILE = path.join(basePath, 'data', 'appointments.json');
const LOCAL_EMAIL_SETTINGS_FILE = path.join(basePath, 'data', 'emailSettings.json');
const LOCAL_GALLERY_FILE = path.join(basePath, 'data', 'gallery.json');
const LOCAL_SITE_DATA_FILE = path.join(basePath, 'data', 'siteData.json');

// Check if local directory is writable
let isLocalWritable = false;
try {
  const testFile = path.join(basePath, 'data', '.write_test');
  fs.writeFileSync(testFile, '1');
  fs.unlinkSync(testFile);
  isLocalWritable = true;
} catch (e) {
  isLocalWritable = false;
}

const PRODUCTS_FILE = isLocalWritable 
  ? LOCAL_PRODUCTS_FILE 
  : path.join(os.tmpdir(), 'micro_products.json');

const BLOGS_FILE = isLocalWritable 
  ? LOCAL_BLOGS_FILE 
  : path.join(os.tmpdir(), 'micro_blogs.json');

const APPOINTMENTS_FILE = isLocalWritable
  ? LOCAL_APPOINTMENTS_FILE
  : path.join(os.tmpdir(), 'micro_appointments.json');

const EMAIL_SETTINGS_FILE = isLocalWritable
  ? LOCAL_EMAIL_SETTINGS_FILE
  : path.join(os.tmpdir(), 'micro_email_settings.json');

const GALLERY_FILE = LOCAL_GALLERY_FILE;
const SITE_DATA_FILE = LOCAL_SITE_DATA_FILE;

// Memory caches
let productsCache = null;
let blogsCache = null;
let appointmentsCache = null;
let emailSettingsCache = null;
let siteDataCache = null;

function readJsonFile(filePath, fallback = [], seedFile = null) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } else if (seedFile && fs.existsSync(seedFile)) {
      const data = fs.readFileSync(seedFile, 'utf8');
      try { fs.writeFileSync(filePath, data, 'utf8'); } catch (e) {}
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[ContentStore] Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[ContentStore] Error writing ${filePath}:`, err);
    return false;
  }
}

// Helper: Slug generator
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Helper: Strip HTML for excerpts
function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate estimated read time from text
function calculateReadTime(text) {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(words / 200) || 1;
  return `${minutes} min read`;
}

const contentStore = {
  // PRODUCTS
  getProducts() {
    if (!productsCache) {
      productsCache = readJsonFile(PRODUCTS_FILE, [], LOCAL_PRODUCTS_FILE);
    }
    return productsCache;
  },

  getProductById(id) {
    const list = this.getProducts();
    return list.find(p => String(p.id) === String(id));
  },

  getProductBySlug(slug) {
    const list = this.getProducts();
    return list.find(p => p.slug === slug);
  },

  createProduct(data) {
    const list = this.getProducts();
    const nextId = list.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    
    let slug = slugify(data.slug || data.title);
    if (!slug) slug = `product-${nextId}`;
    
    // Ensure slug is unique
    let uniqueSlug = slug;
    let counter = 1;
    while (list.some(p => p.slug === uniqueSlug)) {
      uniqueSlug = `${slug}-${counter++}`;
    }

    const newProduct = {
      id: nextId,
      slug: uniqueSlug,
      title: data.title ? data.title.trim() : 'Untitled Product',
      brand: data.brand || 'Micro Hearing',
      type: data.type || 'Behind-the-Ear (BTE)',
      image: data.image || '/images/micro-rexton-hearing-aid-batteries-dhaka-bangladesh.webp',
      originalUrl: data.originalUrl || '',
      featured: Boolean(data.featured),
      inStock: data.inStock !== undefined ? Boolean(data.inStock) : true,
      description: data.description ? data.description.trim() : ''
    };

    list.unshift(newProduct);
    writeJsonFile(PRODUCTS_FILE, list);
    productsCache = list;
    return newProduct;
  },

  updateProduct(id, data) {
    const list = this.getProducts();
    const index = list.findIndex(p => String(p.id) === String(id));
    if (index === -1) return null;

    const existing = list[index];
    let slug = data.slug ? slugify(data.slug) : existing.slug;
    
    // Check if new slug collides with another product
    if (slug !== existing.slug) {
      let uniqueSlug = slug;
      let counter = 1;
      while (list.some(p => p.slug === uniqueSlug && String(p.id) !== String(id))) {
        uniqueSlug = `${slug}-${counter++}`;
      }
      slug = uniqueSlug;
    }

    const updated = {
      ...existing,
      title: data.title !== undefined ? data.title.trim() : existing.title,
      slug,
      brand: data.brand !== undefined ? data.brand : existing.brand,
      type: data.type !== undefined ? data.type : existing.type,
      image: data.image !== undefined ? data.image : existing.image,
      originalUrl: data.originalUrl !== undefined ? data.originalUrl : existing.originalUrl,
      featured: data.featured !== undefined ? Boolean(data.featured) : existing.featured,
      inStock: data.inStock !== undefined ? Boolean(data.inStock) : existing.inStock,
      description: data.description !== undefined ? data.description.trim() : existing.description
    };

    list[index] = updated;
    writeJsonFile(PRODUCTS_FILE, list);
    productsCache = list;
    return updated;
  },

  deleteProduct(id) {
    let list = this.getProducts();
    const initialLen = list.length;
    list = list.filter(p => String(p.id) !== String(id));
    if (list.length !== initialLen) {
      writeJsonFile(PRODUCTS_FILE, list);
      productsCache = list;
      return true;
    }
    return false;
  },

  // BLOGS
  getBlogs() {
    if (!blogsCache) {
      blogsCache = readJsonFile(BLOGS_FILE, [], LOCAL_BLOGS_FILE);
    }
    return blogsCache;
  },

  getBlogById(id) {
    const list = this.getBlogs();
    return list.find(b => String(b.id) === String(id));
  },

  getBlogBySlug(slug) {
    const list = this.getBlogs();
    return list.find(b => b.slug === slug);
  },

  createBlog(data) {
    const list = this.getBlogs();
    const nextId = list.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0) + 1;

    let slug = slugify(data.slug || data.title);
    if (!slug) slug = `post-${nextId}`;

    let uniqueSlug = slug;
    let counter = 1;
    while (list.some(b => b.slug === uniqueSlug)) {
      uniqueSlug = `${slug}-${counter++}`;
    }

    const dateFormatted = data.date || new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const readTime = data.readTime || calculateReadTime(data.content || data.excerpt || '');

    const newBlog = {
      id: nextId,
      slug: uniqueSlug,
      title: data.title ? data.title.trim() : 'Untitled Post',
      category: data.category || 'General Audiology',
      author: data.author || 'Dr. Audiology Team, MHCC',
      date: dateFormatted,
      readTime,
      image: data.image || '/images/micro-audiologist-hearing-aid-fitting-uttara-bangladesh.jpg',
      excerpt: data.excerpt ? data.excerpt.trim() : stripHtml(data.content || '').substring(0, 160) + '...',
      content: data.content ? data.content.trim() : '<p>Write your article here...</p>',
      featured: Boolean(data.featured),
      published: data.published !== undefined ? Boolean(data.published) : true
    };

    list.unshift(newBlog);
    writeJsonFile(BLOGS_FILE, list);
    blogsCache = list;
    return newBlog;
  },

  updateBlog(id, data) {
    const list = this.getBlogs();
    const index = list.findIndex(b => String(b.id) === String(id));
    if (index === -1) return null;

    const existing = list[index];
    let slug = data.slug ? slugify(data.slug) : existing.slug;

    if (slug !== existing.slug) {
      let uniqueSlug = slug;
      let counter = 1;
      while (list.some(b => b.slug === uniqueSlug && String(b.id) !== String(id))) {
        uniqueSlug = `${slug}-${counter++}`;
      }
      slug = uniqueSlug;
    }

    const updated = {
      ...existing,
      title: data.title !== undefined ? data.title.trim() : existing.title,
      slug,
      category: data.category !== undefined ? data.category : existing.category,
      author: data.author !== undefined ? data.author : existing.author,
      date: data.date !== undefined ? data.date : existing.date,
      readTime: data.readTime || (data.content ? calculateReadTime(data.content) : existing.readTime),
      image: data.image !== undefined ? data.image : existing.image,
      excerpt: data.excerpt !== undefined ? data.excerpt.trim() : existing.excerpt,
      content: data.content !== undefined ? data.content.trim() : existing.content,
      featured: data.featured !== undefined ? Boolean(data.featured) : existing.featured,
      published: data.published !== undefined ? Boolean(data.published) : existing.published
    };

    list[index] = updated;
    writeJsonFile(BLOGS_FILE, list);
    blogsCache = list;
    return updated;
  },

  deleteBlog(id) {
    let list = this.getBlogs();
    const initialLen = list.length;
    list = list.filter(b => String(b.id) !== String(id));
    if (list.length !== initialLen) {
      writeJsonFile(BLOGS_FILE, list);
      blogsCache = list;
      return true;
    }
    return false;
  },

  // APPOINTMENTS
  getAppointments() {
    if (!appointmentsCache) {
      appointmentsCache = readJsonFile(APPOINTMENTS_FILE, [], LOCAL_APPOINTMENTS_FILE);
    }
    return appointmentsCache;
  },

  getAppointmentById(id) {
    const list = this.getAppointments();
    return list.find(a => String(a.id) === String(id));
  },

  createAppointment(data) {
    const list = this.getAppointments();
    const nextId = list.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0) + 1;

    const branchKey = (data.branch || 'uttara').toLowerCase();
    const branchName = branchKey === 'gazipur'
      ? 'Gazipur Branch (Chandana Chowrasta)'
      : 'Uttara Head Office (Sector-11)';

    const now = new Date();
    const createdAt = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const newAppointment = {
      id: nextId,
      name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      branch: branchKey,
      branchName,
      preferredDate: (data.preferredDate || '').trim() || 'Anytime (10:00 AM - 10:00 PM)',
      ageGroup: (data.ageGroup || '').trim() || 'Not specified',
      message: (data.message || '').trim() || 'No additional notes',
      status: data.status || 'Pending',
      emailTo: data.emailTo || 'microhearingaidbd@gmail.com',
      emailStatus: data.emailStatus || 'Sent',
      createdAt,
      timestamp: now.toISOString()
    };

    list.unshift(newAppointment);
    writeJsonFile(APPOINTMENTS_FILE, list);
    appointmentsCache = list;
    return newAppointment;
  },

  updateAppointment(id, data) {
    const list = this.getAppointments();
    const index = list.findIndex(a => String(a.id) === String(id));
    if (index === -1) return null;

    const existing = list[index];
    const updated = {
      ...existing,
      ...data,
      id: existing.id
    };

    list[index] = updated;
    writeJsonFile(APPOINTMENTS_FILE, list);
    appointmentsCache = list;
    return updated;
  },

  deleteAppointment(id) {
    let list = this.getAppointments();
    const initialLen = list.length;
    list = list.filter(a => String(a.id) !== String(id));
    if (list.length !== initialLen) {
      writeJsonFile(APPOINTMENTS_FILE, list);
      appointmentsCache = list;
      return true;
    }
    return false;
  },

  // EMAIL NOTIFICATION SETTINGS
  getEmailSettings() {
    const defaults = {
      recipientEmail: process.env.APPOINTMENT_EMAIL || 'microhearingaidbd@gmail.com',
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: Number(process.env.SMTP_PORT) || 465,
      smtpUser: process.env.SMTP_USER || 'microhearingaidbd@gmail.com',
      smtpPass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''
    };
    if (!emailSettingsCache) {
      const saved = readJsonFile(EMAIL_SETTINGS_FILE, null, LOCAL_EMAIL_SETTINGS_FILE);
      emailSettingsCache = saved && typeof saved === 'object' ? { ...defaults, ...saved } : defaults;
    }
    return emailSettingsCache;
  },

  saveEmailSettings(newSettings) {
    const current = this.getEmailSettings();
    const updated = {
      recipientEmail: (newSettings.recipientEmail || 'microhearingaidbd@gmail.com').trim(),
      smtpHost: (newSettings.smtpHost || 'smtp.gmail.com').trim(),
      smtpPort: Number(newSettings.smtpPort) || 465,
      smtpUser: (newSettings.smtpUser || 'microhearingaidbd@gmail.com').trim(),
      smtpPass: newSettings.smtpPass !== undefined ? newSettings.smtpPass.trim() : current.smtpPass
    };
    writeJsonFile(EMAIL_SETTINGS_FILE, updated);
    emailSettingsCache = updated;
    return updated;
  },

  // STATS
  getStats() {
    const products = this.getProducts();
    const blogs = this.getBlogs();
    const appointments = this.getAppointments();
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    const types = [...new Set(products.map(p => p.type).filter(Boolean))];
    const categories = [...new Set(blogs.map(b => b.category).filter(Boolean))];

    return {
      totalProducts: products.length,
      inStockCount: products.filter(p => p.inStock).length,
      outOfStockCount: products.filter(p => !p.inStock).length,
      featuredProducts: products.filter(p => p.featured).length,
      totalBrands: brands.length,
      brandsList: brands,
      typesList: types,
      totalBlogs: blogs.length,
      publishedBlogs: blogs.filter(b => b.published).length,
      categoriesList: categories,
      totalAppointments: appointments.length,
      pendingAppointments: appointments.filter(a => a.status === 'Pending').length,
      confirmedAppointments: appointments.filter(a => a.status === 'Confirmed').length,
      completedAppointments: appointments.filter(a => a.status === 'Completed').length
    };
  }
};

module.exports = {
  contentStore,
  slugify,
  stripHtml,
  calculateReadTime
};
