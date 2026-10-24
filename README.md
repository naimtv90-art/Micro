# Micro Hearing Aid Centre (MHCC) - Ultra-Fast Node.js Website

A high-performance, full-featured Node.js / Express SSR web application for **Micro Hearing Aid Centre Bangladesh** (MHCC), rebuilt from WordPress for maximum speed, SEO optimization, and seamless Vercel deployment.

🌐 **Original Website**: [microhearingaidbd.com](https://microhearingaidbd.com/)  
🏥 **Clinics**: Uttara & Gazipur, Bangladesh  
📞 **24/7 Helpline**: +88 01787 51 999 5  

---

## 🚀 Key Features

- **Blazing-Fast Speed**: Server-Side Rendered (SSR) with EJS templates, Brotli/Gzip compression, and optimized asset delivery.
- **Side-to-Side Product Carousel**: Continuous autoplaying hero slider with touch swipe, circular `<` / `>` controls, and pause on hover.
- **Clean Single-Line Navigation**: Responsive desktop & mobile header with dedicated WhatsApp and emergency calling buttons.
- **Interactive Product Catalog**: Instant client-side search and filtering by brand (Phonak, Rexton, Unitron) and hearing aid style (RIC, BTE, CIC, ITE).
- **Online Appointment Booking**: Modal with AJAX submission and direct WhatsApp confirmation.
- **Interactive Clinic Maps**: Integrated Google Maps for both Uttara and Gazipur branches.
- **100% Vercel Ready**: Ready for serverless deployment with `vercel.json` and `api/index.js`.

---

## 📁 Project Structure

```
d:/Antygravity/Micro/
├── api/
│   └── index.js            # Vercel Serverless Function entrypoint
├── data/
│   ├── products.json       # Structured hearing aid catalog (38 products)
│   └── siteData.json       # Site config, contact info, clinic branches
├── public/
│   ├── css/
│   │   └── style.css       # Custom design system with zero framework bloat
│   ├── images/             # All optimized brand & product images
│   └── js/
│       └── main.js         # Lightweight client-side interactive logic
├── views/
│   ├── partials/
│   │   ├── header.ejs      # Single-line header & navigation
│   │   └── footer.ejs      # Comprehensive footer & appointment modal
│   ├── index.ejs           # Homepage with hero continuous slider
│   ├── products.ejs        # Product catalog with real-time filters
│   ├── product-detail.ejs  # Individual product page
│   ├── services.ejs        # Audiology services
│   ├── contact.ejs         # Contact page with interactive maps
│   └── ...                 # Additional information & brand pages
├── vercel.json             # Vercel routing and serverless configuration
├── server.js               # Express SSR application server
└── package.json            # Node.js dependencies & scripts
```

---

## 🛠️ Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   # or
   node server.js
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment on Vercel

### Option 1: Via Vercel Web Dashboard (Recommended)
1. Push this repository to GitHub (`naimtv90-art/Micro`).
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import the `naimtv90-art/Micro` repository.
4. Click **Deploy** (no build settings needed, `vercel.json` configures everything automatically).

### Option 2: Via Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 📞 Support & Contacts

- **Phone**: 01787 51 999 5, 01788 552 559, 01977 237 740
- **Email**: info@microhearingaidbd.com
- **WhatsApp**: [Chat on WhatsApp](https://wa.me/8801787519995)
