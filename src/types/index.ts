// ==================== AUTH TYPES ====================
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  store?: Store;
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  canAddInventory: boolean;
  canRemoveInventory: boolean;
  canViewInventory: boolean;
  canAddSale: boolean;
  canViewSales: boolean;
  canViewReports: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ==================== STORE TYPES ====================
export interface Store {
  _id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreDto {
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive?: boolean;
}

// ==================== PRODUCT TYPES ====================
export interface Product {
  _id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  isActive: boolean;
  // Campos para sistema de tallas
  baseName?: string;
  sizeType?: 'zapatos' | 'bebe' | 'nino' | 'adulto' | 'unica' | null;
  size?: string;
  // Tracking
  createdBy?: User | string;
  updatedBy?: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  isActive?: boolean;
}

// ==================== INVENTORY TYPES ====================
export interface Inventory {
  _id: string;
  product: Product;
  store: Store;
  quantity: number;
  minStock: number;
  maxStock: number;
  lastRestockDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryDto {
  product: string;
  store: string;
  quantity: number;
  minStock?: number;
  maxStock?: number;
}

export interface UpdateInventoryDto {
  quantity?: number;
  minStock?: number;
  maxStock?: number;
}

// ==================== SALE TYPES ====================
export type PaymentMethod = 'efectivo' | 'nequi' | 'daviplata' | 'llave_bancolombia' | 'tarjeta' | 'transferencia';

export interface Sale {
  _id: string;
  store: Store;
  user: User;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status?: 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  modifiedBy?: User;
  modifiedAt?: string;
  cancelledBy?: User;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  product: Product;
  quantity: number;
  price: number;
  subtotal: number;
  _id?: string;
}

export interface CreateSaleDto {
  store: string;
  items: {
    product: string;
    quantity: number;
    price: number;
  }[];
  paymentMethod: PaymentMethod;
  discount?: number;
  notes?: string;
}

// ==================== DASHBOARD TYPES ====================
export interface DashboardStats {
  totalSales: number;
  salesCount: number;
  productsCount: number;
  storesCount: number;
  lowStockProducts: number;
  topProducts: Array<{
    product: Product;
    quantity: number;
    revenue: number;
  }>;
  salesByStore: Array<{
    store: Store;
    total: number;
    count: number;
  }>;
  recentSales: Sale[];
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    statusCode: number;
    errors?: Record<string, string[]>;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// ==================== FORM TYPES ====================
export interface LoginFormData {
  email: string;
  password: string;
}

export interface CreateUserFormData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  store?: string;
  permissions: UserPermissions;
}

export interface UpdateUserFormData {
  name?: string;
  email?: string;
  role?: 'admin' | 'user';
  store?: string;
  permissions?: UserPermissions;
  isActive?: boolean;
}

// ==================== SUPPLIER TYPES ====================
export interface Supplier {
  _id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  categories: string[];
  paymentTerms?: string;
  website?: string;
  notes?: string;
  isActive: boolean;
  rating?: number;
  createdBy?: User | string;
  updatedBy?: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  categories?: string[];
  paymentTerms?: string;
  website?: string;
  notes?: string;
  rating?: number;
}

// ==================== PURCHASE ORDER TYPES ====================
export interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplier: Supplier;
  store: Store;
  items: PurchaseOrderItem[];
  totalCost: number;
  tax: number;
  shippingCost: number;
  finalTotal: number;
  status: 'pending' | 'received' | 'partial' | 'cancelled';
  expectedDeliveryDate?: string;
  receivedDate?: string;
  notes?: string;
  invoiceNumber?: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
  createdBy: User | string;
  updatedBy: User | string;
  receivedBy?: User | string;
  cancelledBy?: User | string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  product: Product | string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  subtotal: number;
  _id?: string;
}

export interface CreatePurchaseOrderDto {
  supplier: string;
  store: string;
  items: {
    product: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
  tax?: number;
  shippingCost?: number;
  expectedDeliveryDate?: string;
  notes?: string;
  invoiceNumber?: string;
}

export interface ReceivePurchaseOrderDto {
  items: {
    productId: string;
    quantityReceived: number;
  }[];
}

