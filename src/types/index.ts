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
export interface Sale {
  _id: string;
  store: Store;
  user: User;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
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
  paymentMethod: 'cash' | 'card' | 'transfer';
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
