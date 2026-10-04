// App State
let products = [];
let invoices = [];
let categories = [];
let settings = {
    cashPercentage: 30
};
let editingProductId = null;
let productToDelete = null;
let uploadedImageFile = null;
let currentInvoiceItems = [];
let currentInvoiceId = null;

const API_BASE = 'http://localhost:3000/api';

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const pages = document.querySelectorAll('.page');
const productsGrid = document.getElementById('products-grid');
const liveCatalogGrid = document.getElementById('live-catalog-grid');
const invoicesGrid = document.getElementById('invoices-grid');
const productModal = document.getElementById('product-modal');
const confirmModal = document.getElementById('confirm-modal');
const categoryModal = document.getElementById('category-modal');
const productForm = document.getElementById('product-form');
const categoryForm = document.getElementById('category-form');
const descriptionsContainer = document.getElementById('descriptions-container');
const imagePreview = document.getElementById('image-preview');
const toast = document.getElementById('toast');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await loadFromAPI();
    initializeNavigation();
    initializeProductForm();
    initializeCategoryForm();
    initializeSettings();
    initializeInvoiceCreator();
    renderProducts();
    updateCurrentSettingsDisplay();
});

// Navigation
function initializeNavigation() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const pageName = tab.dataset.page;
            switchPage(pageName);
        });
    });
}

async function switchPage(pageName) {
    // Reload data when switching to ensure freshness
    await loadFromAPI();
    
    // Update nav tabs
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.page === pageName) {
            tab.classList.add('active');
        }
    });

    // Update pages
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === `${pageName}-page`) {
            page.classList.add('active');
        }
    });

    // Render specific page content
    if (pageName === 'live-catalog') {
        renderLiveCatalog();
    } else if (pageName === 'products') {
        renderProducts();
    } else if (pageName === 'invoices') {
        renderInvoices();
    }
}

// API Management
async function loadFromAPI() {
    try {
        console.log('Loading data from API...');
        const [productsRes, settingsRes, invoicesRes, categoriesRes] = await Promise.all([
            fetch(`${API_BASE}/products`),
            fetch(`${API_BASE}/settings`),
            fetch(`${API_BASE}/invoices`),
            fetch(`${API_BASE}/categories`)
        ]);

        if (!productsRes.ok || !settingsRes.ok) {
            throw new Error('API request failed');
        }

        products = await productsRes.json();
        settings = await settingsRes.json();
        if (invoicesRes.ok) {
            invoices = await invoicesRes.json();
        }
        if (categoriesRes.ok) {
            categories = await categoriesRes.json();
        }
        console.log('Data loaded successfully:', { productsCount: products.length, settings, invoicesCount: invoices.length, categoriesCount: categories.length });
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('خطا در بارگذاری داده‌ها', 'error');
        // Set default values if loading fails
        products = [];
        invoices = [];
        categories = [];
        settings = {
            cashPercentage: 30
        };
    }
}

// Settings
function initializeSettings() {
    const cashPercentageInput = document.getElementById('cash-percentage');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Load current settings
    cashPercentageInput.value = settings.cashPercentage;

    saveSettingsBtn.addEventListener('click', async () => {
        const cashPercentage = parseFloat(cashPercentageInput.value) || 0;

        try {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cashPercentage })
            });
            
            if (res.ok) {
                settings = await res.json();
                await loadFromAPI(); // Reload products with updated prices
                updateCurrentSettingsDisplay();
                showToast('تنظیمات با موفقیت ذخیره شد', 'success');
            } else {
                showToast('خطا در ذخیره تنظیمات', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('خطا در ذخیره تنظیمات', 'error');
        }
    });
}

function updateCurrentSettingsDisplay() {
    document.getElementById('current-cash-percentage').textContent = settings.cashPercentage;
}

// Products Management
function renderProducts() {
    console.log('renderProducts called with', products.length, 'products');
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📦</div>
                <p class="empty-state-text">هنوز محصولی اضافه نشده است</p>
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = products.map(product => {
        console.log('Rendering product image:', product.image);
        return `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-card-image">
            <div class="product-card-content">
                <h3 class="product-card-name">${product.name}</h3>
                <div class="product-card-prices">
                    <div class="price-tag cash">
                        <div class="price-tag-label">قیمت</div>
                        <div class="price-tag-value">${formatPrice(product.cashPrice)}</div>
                    </div>
                </div>
            </div>
            <div class="product-card-actions">
                <button class="btn btn-secondary" onclick="editProduct('${product.id}')">
                    ویرایش
                </button>
                <button class="btn btn-danger" onclick="confirmDeleteProduct('${product.id}')">
                    حذف
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function calculatePrices(baseCost) {
    const cashPrice = baseCost * (1 + settings.cashPercentage / 100);
    return {
        cashPrice: Math.round(cashPrice)
    };
}

function formatPrice(price) {
    return price.toLocaleString('fa-IR') + ' تومان';
}

// Product Form
function initializeProductForm() {
    const addProductBtn = document.getElementById('add-product-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const productImageInput = document.getElementById('product-image');
    const baseCostInput = document.getElementById('base-cost');
    const addDescriptionBtn = document.getElementById('add-description-btn');

    addProductBtn.addEventListener('click', () => {
        openProductModal();
    });

    modalCloseBtn.addEventListener('click', () => {
        closeProductModal();
    });

    cancelBtn.addEventListener('click', () => {
        closeProductModal();
    });

    productImageInput.addEventListener('change', handleImageUpload);

    baseCostInput.addEventListener('input', (e) => {
        const baseCost = parseFloat(e.target.value) || 0;
        const prices = calculatePrices(baseCost);
        document.getElementById('cash-price-display').textContent = formatPrice(prices.cashPrice);
    });

    addDescriptionBtn.addEventListener('click', addDescriptionField);

    productForm.addEventListener('submit', handleProductSubmit);

    // Add initial description field
    addDescriptionField();
}

function openProductModal(product = null) {
    editingProductId = product ? product.id : null;
    uploadedImageFile = null;
    document.getElementById('modal-title').textContent = product ? 'ویرایش محصول' : 'افزودن محصول جدید';

    // Populate category dropdown
    populateCategoryDropdown();

    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('base-cost').value = product.baseCost;
        document.getElementById('product-category').value = product.category || '';

        // Update price displays
        const prices = calculatePrices(product.baseCost);
        document.getElementById('cash-price-display').textContent = formatPrice(prices.cashPrice);

        // Set image preview
        if (product.image) {
            imagePreview.innerHTML = `<img src="${product.image}" alt="تصویر محصول">`;
        }

        // Set descriptions
        descriptionsContainer.innerHTML = '';
        product.descriptions.forEach(desc => {
            addDescriptionField(desc);
        });
    } else {
        productForm.reset();
        document.getElementById('product-id').value = '';
        imagePreview.innerHTML = '<span class="preview-placeholder">تصویر پیش‌نمایش</span>';
        descriptionsContainer.innerHTML = '';
        addDescriptionField();
        document.getElementById('cash-price-display').textContent = '0 تومان';
        document.getElementById('product-category').value = '';
    }

    productModal.classList.add('active');
}

function closeProductModal() {
    productModal.classList.remove('active');
    editingProductId = null;
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        uploadedImageFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.innerHTML = `<img src="${event.target.result}" alt="تصویر محصول">`;
        };
        reader.readAsDataURL(file);
    }
}

function addDescriptionField(value = '') {
    const descriptionItem = document.createElement('div');
    descriptionItem.className = 'description-item';
    descriptionItem.innerHTML = `
        <input type="text" class="form-input description-input" placeholder="توضیح" value="${value}">
        <button type="button" class="btn btn-danger btn-small" onclick="removeDescriptionField(this)">
            ×
        </button>
    `;
    descriptionsContainer.appendChild(descriptionItem);
}

function populateCategoryDropdown() {
    const categorySelect = document.getElementById('product-category');
    categorySelect.innerHTML = '<option value="">بدون دسته‌بندی</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

// Category Form
function initializeCategoryForm() {
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryModalCloseBtn = document.getElementById('category-modal-close-btn');

    addCategoryBtn.addEventListener('click', () => {
        categoryModal.classList.add('active');
        document.getElementById('category-name').value = '';
        renderCategoryList();
    });

    categoryModalCloseBtn.addEventListener('click', () => {
        categoryModal.classList.remove('active');
    });

    categoryForm.addEventListener('submit', handleCategorySubmit);
}

function renderCategoryList() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;

    // Sort categories by order
    const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

    categoryList.innerHTML = sortedCategories.map(category => `
        <div class="category-item" data-category-id="${category.id}">
            <span class="category-item-drag-handle">⋮⋮</span>
            <input type="text" class="category-item-name-input" value="${category.name}" onchange="updateCategoryName('${category.id}', this.value)">
            <div class="category-item-actions">
                <button class="btn btn-danger" onclick="deleteCategory('${category.id}')">حذف</button>
            </div>
        </div>
    `).join('');

    // Initialize Sortable
    if (window.Sortable) {
        new Sortable(categoryList, {
            animation: 150,
            handle: '.category-item',
            onEnd: async function(evt) {
                const categoryItems = categoryList.querySelectorAll('.category-item');
                const updates = [];

                categoryItems.forEach((item, index) => {
                    const categoryId = item.dataset.categoryId;
                    const newOrder = index + 1;
                    updates.push({ categoryId, newOrder });
                });

                // Update all categories
                for (const update of updates) {
                    try {
                        await fetch(`${API_BASE}/categories/${update.categoryId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ order: update.newOrder })
                        });
                    } catch (error) {
                        console.error('Error updating category order:', error);
                    }
                }

                // Reload data
                await loadFromAPI();
                renderCategoryList();
                showToast('ترتیب دسته‌بندی‌ها تغییر کرد', 'success');
            }
        });
    }
}

async function updateCategoryName(categoryId, newName) {
    if (!newName.trim()) {
        showToast('نام دسته‌بندی نمی‌تواند خالی باشد', 'error');
        renderCategoryList();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/categories/${categoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });

        if (res.ok) {
            await loadFromAPI();
            renderCategoryList();
            populateCategoryDropdown();
            showToast('نام دسته‌بندی تغییر کرد', 'success');
        } else {
            showToast('خطا در تغییر نام دسته‌بندی', 'error');
            renderCategoryList();
        }
    } catch (error) {
        console.error('Error updating category name:', error);
        showToast('خطا در تغییر نام دسته‌بندی', 'error');
        renderCategoryList();
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این دسته‌بندی را حذف کنید؟ محصولات این دسته‌بندی به \"بدون دسته‌بندی\" منتقل می‌شوند.')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/categories/${categoryId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            // Update products to remove category
            const productsRes = await fetch(`${API_BASE}/products`);
            const allProducts = await productsRes.json();

            for (const product of allProducts) {
                if (product.category === categoryId) {
                    const formData = new FormData();
                    formData.append('name', product.name);
                    formData.append('baseCost', product.baseCost);
                    formData.append('descriptions', JSON.stringify(product.descriptions));
                    formData.append('category', '');

                    await fetch(`${API_BASE}/products/${product.id}`, {
                        method: 'PUT',
                        body: formData
                    });
                }
            }

            await loadFromAPI();
            renderCategoryList();
            populateCategoryDropdown();
            showToast('دسته‌بندی با موفقیت حذف شد', 'success');
        } else {
            showToast('خطا در حذف دسته‌بندی', 'error');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showToast('خطا در حذف دسته‌بندی', 'error');
    }
}

async function handleCategorySubmit(e) {
    e.preventDefault();

    const categoryName = document.getElementById('category-name').value.trim();

    if (!categoryName) {
        showToast('لطفاً نام دسته‌بندی را وارد کنید', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName })
        });

        if (res.ok) {
            await loadFromAPI();
            categoryModal.classList.remove('active');
            showToast('دسته‌بندی با موفقیت اضافه شد', 'success');
        } else {
            showToast('خطا در ذخیره دسته‌بندی', 'error');
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('خطا در ذخیره دسته‌بندی', 'error');
    }
}

function removeDescriptionField(button) {
    const descriptionItems = descriptionsContainer.querySelectorAll('.description-item');
    if (descriptionItems.length > 1) {
        button.parentElement.remove();
    } else {
        showToast('حداقل یک توضیح باید وجود داشته باشد', 'error');
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('product-id').value;
    const productName = document.getElementById('product-name').value;
    const baseCost = parseFloat(document.getElementById('base-cost').value) || 0;
    const productCategory = document.getElementById('product-category').value;

    // Get descriptions
    const descriptionInputs = descriptionsContainer.querySelectorAll('.description-input');
    const descriptions = Array.from(descriptionInputs)
        .map(input => input.value.trim())
        .filter(value => value !== '');

    if (!productName) {
        showToast('لطفاً نام محصول را وارد کنید', 'error');
        return;
    }

    if (!uploadedImageFile && !editingProductId) {
        showToast('لطفاً تصویر محصول را آپلود کنید', 'error');
        return;
    }

    if (descriptions.length === 0) {
        showToast('لطفاً حداقل یک توضیح وارد کنید', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('name', productName);
    formData.append('baseCost', baseCost);
    formData.append('descriptions', JSON.stringify(descriptions));
    formData.append('category', productCategory);

    if (uploadedImageFile) {
        formData.append('image', uploadedImageFile);
    }

    try {
        let res;
        if (editingProductId) {
            res = await fetch(`${API_BASE}/products/${editingProductId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            res = await fetch(`${API_BASE}/products`, {
                method: 'POST',
                body: formData
            });
        }

        if (res.ok) {
            await loadFromAPI();
            renderProducts();
            closeProductModal();
            showToast(editingProductId ? 'محصول با موفقیت ویرایش شد' : 'محصول با موفقیت اضافه شد', 'success');
        } else {
            showToast('خطا در ذخیره محصول', 'error');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('خطا در ذخیره محصول', 'error');
    }
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        openProductModal(product);
    }
}

function confirmDeleteProduct(productId) {
    productToDelete = productId;
    confirmModal.classList.add('active');
}

async function deleteProduct() {
    if (productToDelete) {
        try {
            const res = await fetch(`${API_BASE}/products/${productToDelete}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                await loadFromAPI();
                renderProducts();
                showToast('محصول با موفقیت حذف شد', 'success');
            } else {
                showToast('خطا در حذف محصول', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('خطا در حذف محصول', 'error');
        }
        productToDelete = null;
    }
    confirmModal.classList.remove('active');
}

// Confirm Modal
document.getElementById('confirm-delete-btn').addEventListener('click', deleteProduct);
document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    confirmModal.classList.remove('active');
    productToDelete = null;
});

// Save All Products (now reloads from API)
document.getElementById('save-all-products-btn').addEventListener('click', async () => {
    await loadFromAPI();
    showToast('همه محصولات با موفقیت بروزرسانی شدند', 'success');
});

// Live Catalog
function renderLiveCatalog() {
    if (products.length === 0) {
        liveCatalogGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📦</div>
                <p class="empty-state-text">هنوز محصولی اضافه نشده است</p>
            </div>
        `;
        return;
    }

    // Group products by category
    const groupedProducts = {};
    products.forEach(product => {
        const categoryId = product.category || 'uncategorized';
        if (!groupedProducts[categoryId]) {
            groupedProducts[categoryId] = [];
        }
        groupedProducts[categoryId].push(product);
    });

    let html = '';

    // Sort categories by order
    const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Render products by category (sorted by order)
    sortedCategories.forEach(category => {
        if (groupedProducts[category.id] && groupedProducts[category.id].length > 0) {
            html += `<div class="category-header">
                <span class="icon">📁</span>
                ${category.name}
            </div>`;
            html += `<div class="live-catalog-grid-category">`;
            groupedProducts[category.id].forEach(product => {
                html += renderCatalogCard(product);
            });
            html += `</div>`;
        }
    });

    // Render uncategorized products
    if (groupedProducts['uncategorized'] && groupedProducts['uncategorized'].length > 0) {
        html += `<div class="category-header">
            <span class="icon">📦</span>
            بدون دسته‌بندی
        </div>`;
        html += `<div class="live-catalog-grid-category">`;
        groupedProducts['uncategorized'].forEach(product => {
            html += renderCatalogCard(product);
        });
        html += `</div>`;
    }

    liveCatalogGrid.innerHTML = html;

    // Initialize download all PDF button
    initializeDownloadAllPDF();
}

function renderCatalogCard(product) {
    return `
        <div class="catalog-card" id="catalog-card-${product.id}">
            <img src="${product.image}" alt="${product.name}" class="catalog-card-image">
            <div class="catalog-card-divider"></div>
            <h3 class="catalog-card-name">${product.name}</h3>
            <div class="catalog-card-descriptions">
                ${product.descriptions.map(desc => `<p>${desc}</p>`).join('')}
            </div>
            <div class="catalog-card-footer">
                <div class="catalog-card-prices">
                    <div class="catalog-price-box cash">
                        <div class="catalog-price-label">قیمت</div>
                        <div class="catalog-price-value">${formatPrice(product.cashPrice)}</div>
                    </div>
                </div>
                <button class="btn btn-primary download-image-btn" onclick="downloadProductImage('${product.id}', '${product.name}')">
                    <span class="icon">📥</span>
                    دانلود تصویر
                </button>
            </div>
        </div>
    `;
}

async function downloadProductImage(productId, productName) {
    const card = document.getElementById(`catalog-card-${productId}`);
    if (!card) return;

    showToast('در حال آماده‌سازی تصویر...', 'success');

    try {
        // Add capturing class to remove size constraints
        card.classList.add('capturing');

        // Capture the entire card with all information
        const canvas = await html2canvas(card, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            allowTaint: true
        });

        // Remove capturing class after capture
        card.classList.remove('capturing');

        const link = document.createElement('a');
        link.download = `${productName}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        showToast('تصویر با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('Image capture error:', error);
        // Make sure to remove class even if there's an error
        card.classList.remove('capturing');
        showToast('خطا در دانلود تصویر', 'error');
    }
}

function initializeDownloadAllPDF() {
    const downloadAllBtn = document.getElementById('download-all-pdf-btn');
    if (downloadAllBtn) {
        downloadAllBtn.removeEventListener('click', downloadAllCatalogAsPDF);
        downloadAllBtn.addEventListener('click', downloadAllCatalogAsPDF);
    }
}

async function downloadAllCatalogAsPDF() {
    if (products.length === 0) {
        showToast('محصولی برای دانلود وجود ندارد', 'error');
        return;
    }

    showToast('در حال آماده‌سازی PDF...', 'success');

    try {
        // Add capturing class to all cards to remove size constraints
        const allCards = liveCatalogGrid.querySelectorAll('.catalog-card');
        allCards.forEach(card => card.classList.add('capturing'));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);

        // Get all category sections
        const categorySections = liveCatalogGrid.querySelectorAll('.live-catalog-grid-category');
        const totalPages = categorySections.length;

        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            const section = categorySections[pageNum];

            // Hide all sections first
            categorySections.forEach(s => s.style.display = 'none');
            // Hide all category headers
            const allHeaders = liveCatalogGrid.querySelectorAll('.category-header');
            allHeaders.forEach(h => h.style.display = 'none');

            // Show only current section and its header
            section.style.display = 'grid';
            const header = section.previousElementSibling;
            if (header && header.classList.contains('category-header')) {
                header.style.display = 'flex';
            }

            // Capture this page
            const canvas = await html2canvas(liveCatalogGrid, {
                scale: 1.5,
                useCORS: true,
                backgroundColor: '#FFFFFF'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            // Calculate dimensions to fit on PDF page
            const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;

            // Center the image on the page
            const x = (pageWidth - finalWidth) / 2;
            const y = margin;

            // Add new page if not first
            if (pageNum > 0) {
                pdf.addPage();
            }

            pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
        }

        // Restore all sections and headers
        categorySections.forEach(s => s.style.display = 'grid');
        const allHeaders = liveCatalogGrid.querySelectorAll('.category-header');
        allHeaders.forEach(h => h.style.display = 'flex');

        // Remove capturing class after capturing
        allCards.forEach(card => card.classList.remove('capturing'));

        pdf.save('کاتالوگ-محصولات.pdf');

        showToast('PDF با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('خطا در ایجاد PDF', 'error');
        // Make sure to remove capturing class even if there's an error
        const allCards = liveCatalogGrid.querySelectorAll('.catalog-card');
        allCards.forEach(card => card.classList.remove('capturing'));
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toastMessage = toast.querySelector('.toast-message');
    toastMessage.textContent = message;
    
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal on outside click
productModal.addEventListener('click', (e) => {
    if (e.target === productModal) {
        closeProductModal();
    }
});

confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        confirmModal.classList.remove('active');
        productToDelete = null;
    }
});

// Invoice Management

function renderInvoices() {
    if (!invoices || invoices.length === 0) {
        invoicesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📄</div>
                <p class="empty-state-text">هنوز صورتحسابی ایجاد نشده است</p>
            </div>
        `;
        return;
    }

    invoicesGrid.innerHTML = invoices.map(invoice => `
        <div class="invoice-card">
            <div class="invoice-card-header">
                <h3 class="invoice-card-customer">${invoice.customerName}</h3>
                <span class="invoice-card-number">#${invoice.id.slice(-6)}</span>
            </div>
            <div class="invoice-card-details">
                <p>تاریخ: ${invoice.date}</p>
                <p>ساعت: ${invoice.time}</p>
                <p>تعداد اقلام: ${invoice.items.length}</p>
                <p class="invoice-total">مبلغ کل: ${formatPrice(invoice.totalAmount)}</p>
            </div>
            <div class="invoice-card-actions">
                <button class="btn btn-secondary" onclick="editInvoice('${invoice.id}')">
                    ایجاد تغییرات
                </button>
                <button class="btn btn-danger" onclick="confirmDeleteInvoice('${invoice.id}')">
                    حذف
                </button>
            </div>
        </div>
    `).join('');
}

function initializeInvoiceCreator() {
    const createInvoiceBtn = document.getElementById('create-invoice-btn');
    const backToInvoicesBtn = document.getElementById('back-to-invoices-btn');
    const productSearch = document.getElementById('product-search');
    const saveInvoiceBtn = document.getElementById('save-invoice-btn');
    const downloadInvoiceImageBtn = document.getElementById('download-invoice-image-btn');
    const downloadInvoicePdfBtn = document.getElementById('download-invoice-pdf-btn');

    // Initialize Persian number inputs
    initializePersianNumberInputs();

    createInvoiceBtn.addEventListener('click', () => {
        currentInvoiceItems = [];
        currentInvoiceId = null;
        document.getElementById('invoice-customer-name').value = '';
        
        // Set current date in Persian
        const now = new Date();
        const persianDate = now.toLocaleDateString('fa-IR');
        const dateParts = persianDate.split('/');
        document.getElementById('invoice-year').value = toPersianDigits(dateParts[0]);
        document.getElementById('invoice-month').value = toPersianDigits(dateParts[1]);
        document.getElementById('invoice-day').value = toPersianDigits(dateParts[2]);
        
        // Set current time in Persian
        const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        const timeParts = persianTime.split(':');
        document.getElementById('invoice-hour').value = toPersianDigits(timeParts[0]);
        document.getElementById('invoice-minute').value = toPersianDigits(timeParts[1]);
        
        renderInvoiceItems();
        renderInvoicePreview();
        switchPage('invoice-creator');
    });

    backToInvoicesBtn.addEventListener('click', () => {
        switchPage('invoices');
    });

    productSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm.length < 2) {
            document.getElementById('product-search-results').innerHTML = '';
            document.getElementById('product-search-results').classList.remove('show');
            return;
        }

        const filteredProducts = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm)
        );

        document.getElementById('product-search-results').innerHTML = filteredProducts.map(product => `
            <div class="search-result-item" onclick="addProductToInvoice('${product.id}')">
                <span class="search-result-name">${product.name}</span>
                <span class="search-result-price">${formatPrice(product.cashPrice)}</span>
            </div>
        `).join('');
        
        document.getElementById('product-search-results').classList.add('show');
    });

    saveInvoiceBtn.addEventListener('click', saveInvoice);
    downloadInvoiceImageBtn.addEventListener('click', downloadInvoiceImage);
    downloadInvoicePdfBtn.addEventListener('click', downloadInvoicePDF);
}

function initializePersianNumberInputs() {
    const persianInputs = document.querySelectorAll('.persian-number');
    
    persianInputs.forEach(input => {
        // Skip discount percentage inputs to allow real-time updates
        if (input.classList.contains('discount-percentage-input')) {
            return;
        }
        
        input.addEventListener('input', (e) => {
            // Convert any English digits to Persian
            e.target.value = toPersianDigits(e.target.value);
        });
        
        input.addEventListener('keydown', (e) => {
            // Allow only Persian digits and control keys
            const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
            const key = e.key;
            
            // Allow control keys
            if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
                return;
            }
            
            // Convert English digits to Persian
            if (key >= '0' && key <= '9') {
                e.preventDefault();
                const persianDigit = toPersianDigits(key);
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                e.target.value = e.target.value.slice(0, start) + persianDigit + e.target.value.slice(end);
                e.target.setSelectionRange(start + 1, start + 1);
            }
            
            // Check if it's a Persian digit
            if (!persianDigits.includes(key) && key.length === 1) {
                e.preventDefault();
            }
        });
    });
}

function toPersianDigits(str) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/\d/g, d => persianDigits[d]);
}

function addProductToInvoice(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = currentInvoiceItems.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += 1;
        existingItem.total = existingItem.quantity * existingItem.unitPrice;
        if (existingItem.hasDiscount) {
            recalculateItemDiscount(existingItem);
        }
    } else {
        currentInvoiceItems.push({
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.cashPrice,
            total: product.cashPrice,
            hasDiscount: false,
            discountPercentage: 0,
            discountAmount: 0,
            finalTotal: product.cashPrice
        });
    }

    document.getElementById('product-search').value = '';
    document.getElementById('product-search-results').innerHTML = '';
    renderInvoiceItems();
    renderInvoicePreview();
}

function renderInvoiceItems() {
    const itemsList = document.getElementById('invoice-items-list');
    
    if (currentInvoiceItems.length === 0) {
        itemsList.innerHTML = '<p class="empty-items">هیچ آیتمی اضافه نشده است</p>';
        return;
    }

    itemsList.innerHTML = currentInvoiceItems.map((item, index) => `
        <div class="invoice-item">
            <div class="invoice-item-info">
                <span class="invoice-item-name">${item.name}</span>
                <span class="invoice-item-price">${formatPrice(item.unitPrice)}</span>
            </div>
            <div class="invoice-item-controls">
                <button class="btn btn-small btn-secondary" onclick="updateInvoiceItemQuantity(${index}, -1)">-</button>
                <input type="text" 
                       class="form-input invoice-quantity-input persian-number" 
                       value="${toPersianDigits(item.quantity.toString())}" 
                       min="1"
                       onchange="updateInvoiceItemQuantityDirect(${index}, this.value)"
                       onkeydown="handleQuantityInputKeydown(event, ${index}, this)">
                <button class="btn btn-small btn-secondary" onclick="updateInvoiceItemQuantity(${index}, 1)">+</button>
                <button class="btn btn-small btn-danger" onclick="removeInvoiceItem(${index})">×</button>
            </div>
            <div class="invoice-item-discount-section">
                <label class="discount-checkbox">
                    <input type="checkbox" 
                           ${item.hasDiscount ? 'checked' : ''} 
                           onchange="toggleItemDiscount(${index}, this.checked)">
                    <span>تخفیف</span>
                </label>
                ${item.hasDiscount ? `
                    <input type="text" 
                           class="form-input discount-percentage-input" 
                           value="${item.discountPercentage || 0}" 
                           placeholder="درصد"
                           oninput="updateItemDiscountPercentage(${index}, this.value)"
                           onchange="updateItemDiscountPercentage(${index}, this.value)">
                    <span class="discount-symbol">%</span>
                ` : ''}
            </div>
            <div class="invoice-item-total">
                ${item.hasDiscount ? `
                    <div class="original-price">${formatPrice(item.total)}</div>
                    <div class="discounted-price">${formatPrice(item.finalTotal || item.total)}</div>
                ` : formatPrice(item.total)}
            </div>
        </div>
    `).join('');
    
    // Initialize Persian number inputs for newly rendered items
    initializePersianNumberInputs();
}

function updateInvoiceItemQuantity(index, change) {
    const item = currentInvoiceItems[index];
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeInvoiceItem(index);
        return;
    }
    
    item.total = item.quantity * item.unitPrice;
    if (item.hasDiscount) {
        recalculateItemDiscount(item);
    }
    renderInvoiceItems();
    renderInvoicePreview();
}

function updateInvoiceItemQuantityDirect(index, value) {
    const item = currentInvoiceItems[index];
    const quantity = parseInt(persianToEnglishDigits(value)) || 0;
    
    if (quantity <= 0) {
        removeInvoiceItem(index);
        return;
    }
    
    item.quantity = quantity;
    item.total = item.quantity * item.unitPrice;
    if (item.hasDiscount) {
        recalculateItemDiscount(item);
    }
    renderInvoiceItems();
    renderInvoicePreview();
}

function handleQuantityInputKeydown(event, index, input) {
    if (event.key === 'Enter') {
        event.preventDefault();
        updateInvoiceItemQuantityDirect(index, input.value);
    }
}

function toggleItemDiscount(index, hasDiscount) {
    const item = currentInvoiceItems[index];
    item.hasDiscount = hasDiscount;
    
    if (!hasDiscount) {
        item.discountPercentage = 0;
        item.discountAmount = 0;
        item.finalTotal = item.total;
    } else {
        // Keep existing discount percentage if it exists, otherwise set to 0
        if (!item.discountPercentage) {
            item.discountPercentage = 0;
        }
        if (!item.discountAmount) {
            item.discountAmount = 0;
        }
        if (!item.finalTotal) {
            item.finalTotal = item.total;
        }
    }
    
    renderInvoiceItems();
    renderInvoicePreview();
}

function updateItemDiscountPercentage(index, value) {
    const item = currentInvoiceItems[index];
    const percentage = parseInt(persianToEnglishDigits(value)) || 0;
    
    item.discountPercentage = Math.min(100, Math.max(0, percentage));
    recalculateItemDiscount(item);
    
    // Only update the preview, don't re-render items to preserve input focus
    renderInvoicePreview();
    
    // Update the total display for this specific item
    const totalDisplay = document.querySelectorAll('.invoice-item-total')[index];
    if (totalDisplay && item.hasDiscount) {
        totalDisplay.innerHTML = `
            <div class="original-price">${formatPrice(item.total)}</div>
            <div class="discounted-price">${formatPrice(item.finalTotal || item.total)}</div>
        `;
    }
    
    // Update the input value to show the actual percentage being applied
    const input = document.querySelectorAll('.discount-percentage-input')[index];
    if (input) {
        input.value = item.discountPercentage;
    }
}

function recalculateItemDiscount(item) {
    item.discountAmount = Math.round(item.total * (item.discountPercentage / 100));
    item.finalTotal = item.total - item.discountAmount;
}

function persianToEnglishDigits(str) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/[۰-۹]/g, d => persianDigits.indexOf(d));
}

function removeInvoiceItem(index) {
    currentInvoiceItems.splice(index, 1);
    renderInvoiceItems();
    renderInvoicePreview();
}

function renderInvoicePreview() {
    const customerName = document.getElementById('invoice-customer-name').value || 'نام مشتری';
    const year = document.getElementById('invoice-year').value || '۱۴۰۳';
    const month = document.getElementById('invoice-month').value || '۰۷';
    const day = document.getElementById('invoice-day').value || '۱۰';
    const hour = document.getElementById('invoice-hour').value || '۱۴';
    const minute = document.getElementById('invoice-minute').value || '۳۰';
    
    const date = `${year}/${month}/${day}`;
    const time = `${hour}:${minute}`;
    
    const totalQuantity = currentInvoiceItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = currentInvoiceItems.reduce((sum, item) => sum + item.total, 0);
    const totalDiscount = currentInvoiceItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const finalAmount = totalAmount - totalDiscount;
    const totalAmountInWords = numberToPersianWords(finalAmount);
    const hasAnyDiscount = currentInvoiceItems.some(item => item.hasDiscount);

    const invoicePreview = document.getElementById('invoice-preview');
    
    invoicePreview.innerHTML = `
        <div class="invoice-header">
            <div class="invoice-meta">
                <p>شماره: ${currentInvoiceId ? '#' + currentInvoiceId.slice(-6) : '...'}</p>
                <p>تاریخ: ${date} - ساعت: ${time}</p>
            </div>
            <div class="invoice-title-section">
                <p class="invoice-quote">راه در جهان یکیست و آن راه، راستی‌ست</p>
                <h1 class="invoice-title">صورتحساب فروش</h1>
            </div>
        </div>
        
        <div class="invoice-company-info">
            <div class="invoice-customer">
                <p>صورتحساب آقای/خانم: ${customerName}</p>
                <p>مهلت تسویه: نقدی</p>
            </div>
            <div class="invoice-company">
                <p>فناور گستر ایرانیان</p>
                <p>شماره ثبت: 5021</p>
            </div>
        </div>
        
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>ردیف</th>
                    <th>نام کالا</th>
                    <th>تعداد</th>
                    <th>بهای واحد</th>
                    ${hasAnyDiscount ? '<th>بهای واحد بعد تخفیف</th>' : ''}
                    <th>مبلغ کل</th>
                    ${hasAnyDiscount ? '<th>تخفیف</th>' : ''}
                    ${hasAnyDiscount ? '<th>مبلغ نهایی</th>' : ''}
                    <th>شرح کالا</th>
                </tr>
            </thead>
            <tbody>
                ${currentInvoiceItems.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${formatPrice(item.unitPrice)}</td>
                        ${hasAnyDiscount ? `<td>${item.hasDiscount ? formatPrice(item.finalTotal / item.quantity) : '-'}</td>` : ''}
                        <td>${formatPrice(item.total)} T</td>
                        ${hasAnyDiscount ? `<td>${item.hasDiscount ? item.discountPercentage + '%' : '-'}</td>` : ''}
                        ${hasAnyDiscount ? `<td><strong>${item.hasDiscount ? formatPrice(item.finalTotal) : formatPrice(item.total)} T</strong></td>` : ''}
                        <td>-</td>
                    </tr>
                `).join('')}
                <tr class="invoice-summary-row">
                    <td colspan="2"><strong>جمع کل فاکتور</strong></td>
                    <td><strong>${totalQuantity}</strong></td>
                    <td></td>
                    ${hasAnyDiscount ? '<td></td>' : ''}
                    <td><strong>${formatPrice(totalAmount)} T</strong></td>
                    ${hasAnyDiscount ? `<td><strong>${formatPrice(totalDiscount)} T</strong></td>` : ''}
                    ${hasAnyDiscount ? `<td><strong>${formatPrice(finalAmount)} T</strong></td>` : ''}
                    <td></td>
                </tr>
            </tbody>
        </table>
        
        <div class="invoice-total-section">
            <p><strong>مبلغ کل: ${formatPrice(totalAmount)} T</strong></p>
            ${totalDiscount > 0 ? `
                <p><strong>مجموع تخفیف: ${formatPrice(totalDiscount)} T</strong></p>
                <p><strong>مبلغ نهایی قابل پرداخت: ${formatPrice(finalAmount)} T</strong></p>
            ` : ''}
        </div>
        
        <div class="invoice-signature-section">
            <div class="signature-box">
                <p>صادر کننده: امیر حسینی</p>
            </div>
            <div class="signature-box">
                <p>مهر و امضاء فروشنده</p>
            </div>
            <div class="signature-box">
                <p>مهر و امضاء تحویل گیرنده</p>
            </div>
            <div class="notes-box">
                <p>توضیحات:</p>
            </div>
        </div>
        
        <div class="invoice-payment-method">
            <p>نحوه تسویه: نقدی</p>
            <p>مانده فاکتور: 0 T</p>
        </div>
        
        <div class="invoice-footer">
            <p>توجه: بازدید و بررسی کالا بر عهده خریدار می‌باشد. پس از خروج کالا از فروشگاه شکست و کسری پذیرفته نیست.</p>
        </div>
        
       
    `;
}

function numberToPersianWords(num) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const numStr = num.toString();
    return numStr.replace(/\d/g, d => persianDigits[d]);
}

async function saveInvoice() {
    const customerName = document.getElementById('invoice-customer-name').value;
    const year = document.getElementById('invoice-year').value;
    const month = document.getElementById('invoice-month').value;
    const day = document.getElementById('invoice-day').value;
    const hour = document.getElementById('invoice-hour').value;
    const minute = document.getElementById('invoice-minute').value;

    if (!customerName || !year || !month || !day || !hour || !minute) {
        showToast('لطفاً تمام فیلدها را پر کنید', 'error');
        return;
    }

    if (currentInvoiceItems.length === 0) {
        showToast('لطفاً حداقل یک محصول به صورتحساب اضافه کنید', 'error');
        return;
    }

    const date = `${year}/${month}/${day}`;
    const time = `${hour}:${minute}`;
    const totalQuantity = currentInvoiceItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = currentInvoiceItems.reduce((sum, item) => sum + item.total, 0);
    const totalDiscount = currentInvoiceItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const finalAmount = totalAmount - totalDiscount;

    try {
        let res;
        if (currentInvoiceId) {
            // Update existing invoice
            res = await fetch(`${API_BASE}/invoices/${currentInvoiceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    date,
                    time,
                    items: currentInvoiceItems,
                    totalAmount,
                    totalDiscount,
                    finalAmount,
                    totalQuantity
                })
            });
        } else {
            // Create new invoice
            res = await fetch(`${API_BASE}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    date,
                    time,
                    items: currentInvoiceItems,
                    totalAmount,
                    totalDiscount,
                    finalAmount,
                    totalQuantity
                })
            });
        }

        if (res.ok) {
            const savedInvoice = await res.json();
            currentInvoiceId = savedInvoice.id;
            await loadFromAPI();
            showToast(currentInvoiceId ? 'صورتحساب با موفقیت ویرایش شد' : 'صورتحساب با موفقیت ذخیره شد', 'success');
        } else {
            showToast('خطا در ذخیره صورتحساب', 'error');
        }
    } catch (error) {
        console.error('Error saving invoice:', error);
        showToast('خطا در ذخیره صورتحساب', 'error');
    }
}

async function downloadInvoiceImage() {
    const invoicePreview = document.getElementById('invoice-preview');

    try {
        showToast('در حال آماده‌سازی تصویر...', 'success');

        const canvas = await html2canvas(invoicePreview, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#FFFFFF',
            logging: false
        });

        const link = document.createElement('a');
        const customerName = document.getElementById('invoice-customer-name').value || 'invoice';
        link.download = `صورتحساب-${customerName}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        showToast('تصویر با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('Image capture error:', error);
        showToast('خطا در دانلود تصویر', 'error');
    }
}

async function downloadInvoicePDF() {
    const invoicePreview = document.getElementById('invoice-preview');

    try {
        showToast('در حال آماده‌سازی PDF...', 'success');

        const canvas = await html2canvas(invoicePreview, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#FFFFFF',
            logging: false
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);

        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;

        const x = (pageWidth - finalWidth) / 2;
        const y = margin;

        pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);

        const customerName = document.getElementById('invoice-customer-name').value || 'invoice';
        pdf.save(`صورتحساب-${customerName}-${Date.now()}.pdf`);

        showToast('PDF با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('خطا در ایجاد PDF', 'error');
    }
}

function editInvoice(invoiceId) {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    currentInvoiceId = invoice.id;
    currentInvoiceItems = invoice.items.map(item => ({
        ...item,
        hasDiscount: item.hasDiscount || false,
        discountPercentage: item.discountPercentage || 0,
        discountAmount: item.discountAmount || 0,
        finalTotal: item.finalTotal || item.total
    }));
    
    document.getElementById('invoice-customer-name').value = invoice.customerName;
    
    // Parse date
    const dateParts = invoice.date.split('/');
    if (dateParts.length === 3) {
        document.getElementById('invoice-year').value = toPersianDigits(dateParts[0]);
        document.getElementById('invoice-month').value = toPersianDigits(dateParts[1]);
        document.getElementById('invoice-day').value = toPersianDigits(dateParts[2]);
    }
    
    // Parse time
    const timeParts = invoice.time.split(':');
    if (timeParts.length === 2) {
        document.getElementById('invoice-hour').value = toPersianDigits(timeParts[0]);
        document.getElementById('invoice-minute').value = toPersianDigits(timeParts[1]);
    }
    
    // Recalculate discounts for items that have discount enabled
    currentInvoiceItems.forEach(item => {
        if (item.hasDiscount && item.discountPercentage > 0) {
            recalculateItemDiscount(item);
        }
    });
    
    renderInvoiceItems();
    renderInvoicePreview();
    switchPage('invoice-creator');
}

function confirmDeleteInvoice(invoiceId) {
    if (confirm('آیا مطمئن هستید که می‌خواهید این صورتحساب را حذف کنید؟')) {
        deleteInvoice(invoiceId);
    }
}

async function deleteInvoice(invoiceId) {
    try {
        const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            await loadFromAPI();
            renderInvoices();
            showToast('صورتحساب با موفقیت حذف شد', 'success');
        } else {
            showToast('خطا در حذف صورتحساب', 'error');
        }
    } catch (error) {
        console.error('Error deleting invoice:', error);
        showToast('خطا در حذف صورتحساب', 'error');
    }
}
