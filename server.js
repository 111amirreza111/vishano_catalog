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
                cashPercentage: 30
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
        
        // Initialize invoices.json if it doesn't exist
        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        try {
            await fs.access(invoicesPath);
        } catch {
            await fs.writeFile(invoicesPath, JSON.stringify([], null, 2));
        }

        // Initialize categories.json if it doesn't exist
        const categoriesPath = path.join(DATA_DIR, 'categories.json');
        try {
            await fs.access(categoriesPath);
        } catch {
            await fs.writeFile(categoriesPath, JSON.stringify([], null, 2));
        }

        // Initialize production.json if it doesn't exist
        const productionPath = path.join(DATA_DIR, 'production.json');
        try {
            await fs.access(productionPath);
        } catch {
            await fs.writeFile(productionPath, JSON.stringify([], null, 2));
        }

        // Initialize customers.json if it doesn't exist
        const customersPath = path.join(DATA_DIR, 'customers.json');
        try {
            await fs.access(customersPath);
        } catch {
            await fs.writeFile(customersPath, JSON.stringify([], null, 2));
        }

        // Initialize payments.json if it doesn't exist
        const paymentsPath = path.join(DATA_DIR, 'payments.json');
        try {
            await fs.access(paymentsPath);
        } catch {
            await fs.writeFile(paymentsPath, JSON.stringify([], null, 2));
        }

        // Initialize inventory.json if it doesn't exist
        const inventoryPath = path.join(DATA_DIR, 'inventory.json');
        try {
            await fs.access(inventoryPath);
        } catch {
            await fs.writeFile(inventoryPath, JSON.stringify([], null, 2));
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
        const { name, baseCost, descriptions, category } = req.body;

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

        const newProduct = {
            id: Date.now().toString(),
            name,
            image: `/uploads/${req.file.filename}`,
            descriptions: descriptions ? JSON.parse(descriptions) : [],
            baseCost: baseCostNum,
            cashPrice,
            category: category || null,
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
        const { name, baseCost, descriptions, category } = req.body;

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
            category: category !== undefined ? category : products[index].category
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
        const { cashPercentage } = req.body;
        
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        const settings = {
            cashPercentage: parseFloat(cashPercentage) || 0
        };
        
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        
        // Recalculate all product prices
        const productsPath = path.join(DATA_DIR, 'products.json');
        const productsData = await fs.readFile(productsPath, 'utf8');
        const products = JSON.parse(productsData);
        
        products.forEach(product => {
            product.cashPrice = Math.round(product.baseCost * (1 + settings.cashPercentage / 100));
        });
        
        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Invoice API Routes

// Get all invoices
app.get('/api/invoices', async (req, res) => {
    try {
        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const data = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(data);
        res.json(invoices);
    } catch (error) {
        console.error('Error reading invoices:', error);
        res.status(500).json({ error: 'Failed to read invoices' });
    }
});

// Get single invoice
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const data = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(data);
        const invoice = invoices.find(i => i.id === req.params.id);
        
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        res.json(invoice);
    } catch (error) {
        console.error('Error reading invoice:', error);
        res.status(500).json({ error: 'Failed to read invoice' });
    }
});

// Create invoice
app.post('/api/invoices', async (req, res) => {
    try {
        const { customerId, customerName, customerPhone, customerAddress, date, time, items, totalAmount, totalDiscount, finalAmount, totalQuantity } = req.body;

        if (!customerName || !date || !time || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const data = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(data);

        const newInvoice = {
            id: Date.now().toString(),
            customerId: customerId || null,
            customerName,
            customerPhone: customerPhone || '',
            customerAddress: customerAddress || '',
            date,
            time,
            items,
            totalAmount,
            totalDiscount: totalDiscount || 0,
            finalAmount: finalAmount || totalAmount,
            totalQuantity,
            createdAt: new Date().toISOString()
        };

        invoices.push(newInvoice);
        await fs.writeFile(invoicesPath, JSON.stringify(invoices, null, 2));

        res.json(newInvoice);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Delete invoice
app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const data = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(data);
        
        const index = invoices.findIndex(i => i.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        invoices.splice(index, 1);
        await fs.writeFile(invoicesPath, JSON.stringify(invoices, null, 2));
        
        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({ error: 'Failed to delete invoice' });
    }
});

// Update invoice
app.put('/api/invoices/:id', async (req, res) => {
    try {
        const { customerId, customerName, customerPhone, customerAddress, date, time, items, totalAmount, totalDiscount, finalAmount, totalQuantity } = req.body;

        if (!customerName || !date || !time || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const data = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(data);

        const index = invoices.findIndex(i => i.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        invoices[index] = {
            ...invoices[index],
            customerId: customerId !== undefined ? customerId : invoices[index].customerId,
            customerName,
            customerPhone: customerPhone !== undefined ? customerPhone : invoices[index].customerPhone,
            customerAddress: customerAddress !== undefined ? customerAddress : invoices[index].customerAddress,
            date,
            time,
            items,
            totalAmount,
            totalDiscount: totalDiscount || 0,
            finalAmount: finalAmount || totalAmount,
            totalQuantity,
            updatedAt: new Date().toISOString()
        };

        await fs.writeFile(invoicesPath, JSON.stringify(invoices, null, 2));

        res.json(invoices[index]);
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ error: 'Failed to update invoice' });
    }
});

// Category API Routes

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const categoriesPath = path.join(DATA_DIR, 'categories.json');
        const data = await fs.readFile(categoriesPath, 'utf8');
        const categories = JSON.parse(data);
        res.json(categories);
    } catch (error) {
        console.error('Error reading categories:', error);
        res.status(500).json({ error: 'Failed to read categories' });
    }
});

// Create category
app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const categoriesPath = path.join(DATA_DIR, 'categories.json');
        const data = await fs.readFile(categoriesPath, 'utf8');
        const categories = JSON.parse(data);

        // Calculate next order
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) : 0;

        const newCategory = {
            id: Date.now().toString(),
            name,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        };

        categories.push(newCategory);
        await fs.writeFile(categoriesPath, JSON.stringify(categories, null, 2));

        res.json(newCategory);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const categoriesPath = path.join(DATA_DIR, 'categories.json');
        const data = await fs.readFile(categoriesPath, 'utf8');
        const categories = JSON.parse(data);

        const index = categories.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }

        categories.splice(index, 1);
        await fs.writeFile(categoriesPath, JSON.stringify(categories, null, 2));

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Update category
app.put('/api/categories/:id', async (req, res) => {
    try {
        const { name, order } = req.body;

        const categoriesPath = path.join(DATA_DIR, 'categories.json');
        const data = await fs.readFile(categoriesPath, 'utf8');
        const categories = JSON.parse(data);

        const index = categories.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }

        categories[index] = {
            ...categories[index],
            name: name !== undefined ? name : categories[index].name,
            order: order !== undefined ? order : categories[index].order
        };

        await fs.writeFile(categoriesPath, JSON.stringify(categories, null, 2));

        res.json(categories[index]);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Inventory API Routes

// Get all inventory records
app.get('/api/inventory', async (req, res) => {
    try {
        const inventoryPath = path.join(DATA_DIR, 'inventory.json');
        const data = await fs.readFile(inventoryPath, 'utf8');
        const inventory = JSON.parse(data);
        res.json(inventory);
    } catch (error) {
        console.error('Error reading inventory:', error);
        res.status(500).json({ error: 'Failed to read inventory' });
    }
});

// Add product to inventory
app.post('/api/inventory', async (req, res) => {
    try {
        const { productId, productName, quantity } = req.body;

        if (!productId || !productName || !quantity) {
            return res.status(400).json({ error: 'ProductId, productName, and quantity are required' });
        }

        const inventoryPath = path.join(DATA_DIR, 'inventory.json');
        const data = await fs.readFile(inventoryPath, 'utf8');
        const inventory = JSON.parse(data);

        // Check if product already exists in inventory
        const existingIndex = inventory.findIndex(item => item.productId === productId);
        if (existingIndex !== -1) {
            // Update existing quantity
            inventory[existingIndex].quantity += parseInt(quantity);
            inventory[existingIndex].updatedAt = new Date().toISOString();
        } else {
            // Add new inventory item
            inventory.push({
                productId,
                productName,
                quantity: parseInt(quantity),
                createdAt: new Date().toISOString()
            });
        }

        await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));

        res.json(existingIndex !== -1 ? inventory[existingIndex] : inventory[inventory.length - 1]);
    } catch (error) {
        console.error('Error adding to inventory:', error);
        res.status(500).json({ error: 'Failed to add to inventory' });
    }
});

// Update inventory quantity
app.put('/api/inventory/:productId', async (req, res) => {
    try {
        const { quantity } = req.body;

        const inventoryPath = path.join(DATA_DIR, 'inventory.json');
        const data = await fs.readFile(inventoryPath, 'utf8');
        const inventory = JSON.parse(data);

        const index = inventory.findIndex(item => item.productId === req.params.productId);
        if (index === -1) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        inventory[index].quantity = parseInt(quantity);
        inventory[index].updatedAt = new Date().toISOString();

        await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));

        res.json(inventory[index]);
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// Delete product from inventory
app.delete('/api/inventory/:productId', async (req, res) => {
    try {
        const inventoryPath = path.join(DATA_DIR, 'inventory.json');
        const data = await fs.readFile(inventoryPath, 'utf8');
        const inventory = JSON.parse(data);

        const index = inventory.findIndex(item => item.productId === req.params.productId);
        if (index === -1) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        inventory.splice(index, 1);
        await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));

        res.json({ message: 'Inventory item deleted successfully' });
    } catch (error) {
        console.error('Error deleting from inventory:', error);
        res.status(500).json({ error: 'Failed to delete from inventory' });
    }
});

// Production API Routes

// Get all production records
app.get('/api/production', async (req, res) => {
    try {
        const productionPath = path.join(DATA_DIR, 'production.json');
        const data = await fs.readFile(productionPath, 'utf8');
        const production = JSON.parse(data);
        res.json(production);
    } catch (error) {
        console.error('Error reading production:', error);
        res.status(500).json({ error: 'Failed to read production' });
    }
});

// Update production record for a product
app.put('/api/production/:productId', async (req, res) => {
    try {
        const { totalDelivered } = req.body;

        const productionPath = path.join(DATA_DIR, 'production.json');
        const data = await fs.readFile(productionPath, 'utf8');
        const production = JSON.parse(data);

        const index = production.findIndex(p => p.productId === req.params.productId);
        if (index === -1) {
            // Create new record if it doesn't exist
            production.push({
                productId: req.params.productId,
                totalDelivered: totalDelivered || 0,
                createdAt: new Date().toISOString()
            });
        } else {
            production[index].totalDelivered = totalDelivered || 0;
            production[index].updatedAt = new Date().toISOString();
        }

        await fs.writeFile(productionPath, JSON.stringify(production, null, 2));

        res.json(production[index] || production[production.length - 1]);
    } catch (error) {
        console.error('Error updating production:', error);
        res.status(500).json({ error: 'Failed to update production' });
    }
});

// Customer API Routes

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const customersPath = path.join(DATA_DIR, 'customers.json');
        const data = await fs.readFile(customersPath, 'utf8');
        const customers = JSON.parse(data);
        res.json(customers);
    } catch (error) {
        console.error('Error reading customers:', error);
        res.status(500).json({ error: 'Failed to read customers' });
    }
});

// Get single customer
app.get('/api/customers/:id', async (req, res) => {
    try {
        const customersPath = path.join(DATA_DIR, 'customers.json');
        const data = await fs.readFile(customersPath, 'utf8');
        const customers = JSON.parse(data);
        const customer = customers.find(c => c.id === req.params.id);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        console.error('Error reading customer:', error);
        res.status(500).json({ error: 'Failed to read customer' });
    }
});

// Create customer
app.post('/api/customers', async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const customersPath = path.join(DATA_DIR, 'customers.json');
        const data = await fs.readFile(customersPath, 'utf8');
        const customers = JSON.parse(data);

        const newCustomer = {
            id: Date.now().toString(),
            name,
            phone: phone || '',
            address: address || '',
            createdAt: new Date().toISOString()
        };

        customers.push(newCustomer);
        await fs.writeFile(customersPath, JSON.stringify(customers, null, 2));

        res.json(newCustomer);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const customersPath = path.join(DATA_DIR, 'customers.json');
        const data = await fs.readFile(customersPath, 'utf8');
        const customers = JSON.parse(data);

        const index = customers.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        customers[index] = {
            ...customers[index],
            name,
            phone: phone !== undefined ? phone : customers[index].phone,
            address: address !== undefined ? address : customers[index].address,
            updatedAt: new Date().toISOString()
        };

        await fs.writeFile(customersPath, JSON.stringify(customers, null, 2));

        res.json(customers[index]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const customersPath = path.join(DATA_DIR, 'customers.json');
        const data = await fs.readFile(customersPath, 'utf8');
        const customers = JSON.parse(data);

        const index = customers.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = customers[index];

        // Check if customer has any invoices
        const invoicesPath = path.join(DATA_DIR, 'invoices.json');
        const invoicesData = await fs.readFile(invoicesPath, 'utf8');
        const invoices = JSON.parse(invoicesData);

        const customerInvoices = invoices.filter(inv =>
            inv.customerId === req.params.id || inv.customerName === customer.name
        );

        if (customerInvoices.length > 0) {
            return res.status(400).json({
                error: `Customer has ${customerInvoices.length} invoice(s). Please delete invoices first.`
            });
        }

        customers.splice(index, 1);
        await fs.writeFile(customersPath, JSON.stringify(customers, null, 2));

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Payment API Routes

// Get all payments
app.get('/api/payments', async (req, res) => {
    try {
        const paymentsPath = path.join(DATA_DIR, 'payments.json');
        const data = await fs.readFile(paymentsPath, 'utf8');
        const payments = JSON.parse(data);
        res.json(payments);
    } catch (error) {
        console.error('Error reading payments:', error);
        res.status(500).json({ error: 'Failed to read payments' });
    }
});

// Get payments for a specific customer
app.get('/api/payments/customer/:customerId', async (req, res) => {
    try {
        const paymentsPath = path.join(DATA_DIR, 'payments.json');
        const data = await fs.readFile(paymentsPath, 'utf8');
        const payments = JSON.parse(data);

        const customerPayments = payments.filter(p => p.customerId === req.params.customerId);
        res.json(customerPayments);
    } catch (error) {
        console.error('Error reading customer payments:', error);
        res.status(500).json({ error: 'Failed to read customer payments' });
    }
});

// Create payment
app.post('/api/payments', async (req, res) => {
    try {
        const { customerId, amount, date, note } = req.body;

        if (!customerId || !amount || !date) {
            return res.status(400).json({ error: 'Customer ID, amount, and date are required' });
        }

        const paymentsPath = path.join(DATA_DIR, 'payments.json');
        const data = await fs.readFile(paymentsPath, 'utf8');
        const payments = JSON.parse(data);

        const newPayment = {
            id: Date.now().toString(),
            customerId,
            amount: parseFloat(amount),
            date,
            note: note || '',
            createdAt: new Date().toISOString()
        };

        payments.push(newPayment);
        await fs.writeFile(paymentsPath, JSON.stringify(payments, null, 2));

        res.json(newPayment);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Delete payment
app.delete('/api/payments/:id', async (req, res) => {
    try {
        const paymentsPath = path.join(DATA_DIR, 'payments.json');
        const data = await fs.readFile(paymentsPath, 'utf8');
        const payments = JSON.parse(data);

        const index = payments.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        payments.splice(index, 1);
        await fs.writeFile(paymentsPath, JSON.stringify(payments, null, 2));

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
