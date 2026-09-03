const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Specific route to serve images with logging
app.get('/uploads/:filename', (req, res, next) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    console.log('Trying to serve image:', filePath);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving image:', err);
            next(err);
        } else {
            console.log('Image served successfully');
        }
    });
});

app.use(express.static(path.join(__dirname)));

// Ensure data directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function ensureDirectories() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        
        // Initialize settings.json if it doesn't exist
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        try {
            await fs.access(settingsPath);
        } catch {
            const defaultSettings = {
                cashPercentage: 30,
                installmentPercentage: 50
            };
            await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
        }
        
        // Initialize products.json if it doesn't exist
        const productsPath = path.join(DATA_DIR, 'products.json');
        try {
            await fs.access(productsPath);
        } catch {
            await fs.writeFile(productsPath, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Favicon route to prevent 404
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// API Routes

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        console.log('GET /api/products - Fetching all products');
        const productsPath = path.join(DATA_DIR, 'products.json');
        const data = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(data);
        console.log('GET /api/products - Returning', products.length, 'products');
        res.json(products);
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ error: 'Failed to read products' });
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const productsPath = path.join(DATA_DIR, 'products.json');
        const data = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(data);
        const product = products.find(p => p.id === req.params.id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error reading product:', error);
        res.status(500).json({ error: 'Failed to read product' });
    }
});

// Create product
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, baseCost, descriptions } = req.body;
        
        if (!name || !baseCost) {
            return res.status(400).json({ error: 'Name and base cost are required' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }
        
        const productsPath = path.join(DATA_DIR, 'products.json');
        const data = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(data);
        
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        
        const baseCostNum = parseFloat(baseCost);
        const cashPrice = Math.round(baseCostNum * (1 + settings.cashPercentage / 100));
        const installmentPrice = Math.round(baseCostNum * (1 + settings.installmentPercentage / 100));
        
        const newProduct = {
            id: Date.now().toString(),
            name,
            image: `/uploads/${req.file.filename}`,
            descriptions: descriptions ? JSON.parse(descriptions) : [],
            baseCost: baseCostNum,
            cashPrice,
            installmentPrice,
            createdAt: new Date().toISOString()
        };
        
        console.log('Saving product with image path:', newProduct.image);
        
        products.push(newProduct);
        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        
        res.json(newProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, baseCost, descriptions } = req.body;
        
        const productsPath = path.join(DATA_DIR, 'products.json');
        const data = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(data);
        
        const index = products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        
        const baseCostNum = parseFloat(baseCost);
        const cashPrice = Math.round(baseCostNum * (1 + settings.cashPercentage / 100));
        const installmentPrice = Math.round(baseCostNum * (1 + settings.installmentPercentage / 100));
        
        // Delete old image if new one is uploaded
        if (req.file && products[index].image) {
            const oldImagePath = path.join(__dirname, products[index].image);
            try {
                await fs.unlink(oldImagePath);
            } catch (err) {
                console.error('Error deleting old image:', err);
            }
        }
        
        products[index] = {
            ...products[index],
            name,
            image: req.file ? `/uploads/${req.file.filename}` : products[index].image,
            descriptions: descriptions ? JSON.parse(descriptions) : products[index].descriptions,
            baseCost: baseCostNum,
            cashPrice,
            installmentPrice
        };
        
        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        
        res.json(products[index]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productsPath = path.join(DATA_DIR, 'products.json');
        const data = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(data);
        
        const index = products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Delete image file
        if (products[index].image) {
            const imagePath = path.join(__dirname, products[index].image);
            try {
                await fs.unlink(imagePath);
            } catch (err) {
                console.error('Error deleting image:', err);
            }
        }
        
        products.splice(index, 1);
        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        const data = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(data);
        res.json(settings);
    } catch (error) {
        console.error('Error reading settings:', error);
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

// Update settings
app.put('/api/settings', async (req, res) => {
    try {
        const { cashPercentage, installmentPercentage } = req.body;
        
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        const settings = {
            cashPercentage: parseFloat(cashPercentage) || 0,
            installmentPercentage: parseFloat(installmentPercentage) || 0
        };
        
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        
        // Recalculate all product prices
        const productsPath = path.join(DATA_DIR, 'products.json');
        const productsData = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(productsData);
        
        products.forEach(product => {
            product.cashPrice = Math.round(product.baseCost * (1 + settings.cashPercentage / 100));
            product.installmentPrice = Math.round(product.baseCost * (1 + settings.installmentPercentage / 100));
        });
        
        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
