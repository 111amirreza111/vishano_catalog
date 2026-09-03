// App State
let products = [];
let settings = {
    cashPercentage: 30,
    installmentPercentage: 50
};
let editingProductId = null;
let productToDelete = null;
let uploadedImageFile = null;

const API_BASE = 'http://localhost:3000/api';

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const pages = document.querySelectorAll('.page');
const productsGrid = document.getElementById('products-grid');
const liveCatalogGrid = document.getElementById('live-catalog-grid');
const productModal = document.getElementById('product-modal');
const confirmModal = document.getElementById('confirm-modal');
const productForm = document.getElementById('product-form');
const descriptionsContainer = document.getElementById('descriptions-container');
const imagePreview = document.getElementById('image-preview');
const toast = document.getElementById('toast');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await loadFromAPI();
    initializeNavigation();
    initializeProductForm();
    initializeSettings();
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
    }
}

// API Management
async function loadFromAPI() {
    try {
        console.log('Loading data from API...');
        const [productsRes, settingsRes] = await Promise.all([
            fetch(`${API_BASE}/products`),
            fetch(`${API_BASE}/settings`)
        ]);
        
        if (!productsRes.ok || !settingsRes.ok) {
            throw new Error('API request failed');
        }
        
        products = await productsRes.json();
        settings = await settingsRes.json();
        console.log('Data loaded successfully:', { productsCount: products.length, settings });
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('خطا در بارگذاری داده‌ها', 'error');
        // Set default values if loading fails
        products = [];
        settings = {
            cashPercentage: 30,
            installmentPercentage: 50
        };
    }
}

// Settings
function initializeSettings() {
    const cashPercentageInput = document.getElementById('cash-percentage');
    const installmentPercentageInput = document.getElementById('installment-percentage');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Load current settings
    cashPercentageInput.value = settings.cashPercentage;
    installmentPercentageInput.value = settings.installmentPercentage;

    saveSettingsBtn.addEventListener('click', async () => {
        const cashPercentage = parseFloat(cashPercentageInput.value) || 0;
        const installmentPercentage = parseFloat(installmentPercentageInput.value) || 0;

        try {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cashPercentage, installmentPercentage })
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
    document.getElementById('current-installment-percentage').textContent = settings.installmentPercentage;
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
                        <div class="price-tag-label">قیمت نقدی</div>
                        <div class="price-tag-value">${formatPrice(product.cashPrice)}</div>
                    </div>
                    <div class="price-tag installment">
                        <div class="price-tag-label">قیمت اقساطی</div>
                        <div class="price-tag-value">${formatPrice(product.installmentPrice)}</div>
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
    const installmentPrice = baseCost * (1 + settings.installmentPercentage / 100);
    return {
        cashPrice: Math.round(cashPrice),
        installmentPrice: Math.round(installmentPrice)
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
        document.getElementById('installment-price-display').textContent = formatPrice(prices.installmentPrice);
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
    
    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('base-cost').value = product.baseCost;
        
        // Update price displays
        const prices = calculatePrices(product.baseCost);
        document.getElementById('cash-price-display').textContent = formatPrice(prices.cashPrice);
        document.getElementById('installment-price-display').textContent = formatPrice(prices.installmentPrice);
        
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
        document.getElementById('installment-price-display').textContent = '0 تومان';
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

    liveCatalogGrid.innerHTML = products.map(product => `
        <div>
            <div class="catalog-card" id="catalog-card-${product.id}">
                <img src="${product.image}" alt="${product.name}" class="catalog-card-image">
                <div class="catalog-card-divider"></div>
                <h3 class="catalog-card-name">${product.name}</h3>
                <div class="catalog-card-descriptions">
                    ${product.descriptions.map(desc => `<p>${desc}</p>`).join('')}
                </div>
                <div class="catalog-card-prices">
                    <div class="catalog-price-box cash">
                        <div class="catalog-price-label">قیمت نقدی</div>
                        <div class="catalog-price-value">${formatPrice(product.cashPrice)}</div>
                    </div>
                    <div class="catalog-price-box installment">
                        <div class="catalog-price-label">قیمت اقساطی</div>
                        <div class="catalog-price-value">${formatPrice(product.installmentPrice)}</div>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary download-image-btn" onclick="downloadProductImage('${product.id}', '${product.name}')">
                <span class="icon">📥</span>
                دانلود تصویر
            </button>
        </div>
    `).join('');

    // Initialize download all PDF button
    initializeDownloadAllPDF();
}

async function downloadProductImage(productId, productName) {
    const card = document.getElementById(`catalog-card-${productId}`);
    if (!card) return;

    showToast('در حال آماده‌سازی تصویر...', 'success');

    try {
        const canvas = await html2canvas(card, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#FFFFFF'
        });

        const link = document.createElement('a');
        link.download = `${productName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('تصویر با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('Image capture error:', error);
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
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);

        // Capture the entire grid as a single screenshot
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

        pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
        pdf.save('کاتالوگ-محصولات.pdf');
        showToast('PDF با موفقیت دانلود شد', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('خطا در ایجاد PDF', 'error');
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
