// RBAC Roles & Authentication Domain Types for BBKitchen

export type SystemRole =
  | 'ADMIN'
  | 'OPERATOR'
  | 'MARKETING'
  | 'FINANCE'
  | 'VIEWER'
  | 'INVESTOR';

export type UserRole = SystemRole | (string & {});

export interface AppRoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: RolePermissions;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface AppUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  permissions?: RolePermissions;
}

export interface RolePermissions {
  canViewInternalCost: boolean;
  canViewFloorPrice: boolean;
  canViewDealPrice: boolean;
  canViewTelegramLink: boolean;
  canViewSupplierData: boolean;
  canMarkAsSold: boolean;
  canEditInventory: boolean;
  canManageInvoices: boolean;
  canViewFinanceReports: boolean;
  canEditSEO: boolean;
  canManageSocialMedia: boolean;
  canViewRawAnalytics: boolean;
  canAccessInvestorPortal: boolean;
  isInvestorRestricted: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN: {
    canViewInternalCost: true,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: true,
    canViewSupplierData: true,
    canMarkAsSold: true,
    canEditInventory: true,
    canManageInvoices: true,
    canViewFinanceReports: true,
    canEditSEO: true,
    canManageSocialMedia: true,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: true,
    isInvestorRestricted: false,
  },
  OPERATOR: {
    canViewInternalCost: false,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: true,
    canViewSupplierData: false,
    canMarkAsSold: true,
    canEditInventory: true,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canEditSEO: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: false,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  MARKETING: {
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canEditInventory: false,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canEditSEO: true,
    canManageSocialMedia: true,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  FINANCE: {
    canViewInternalCost: true,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canEditInventory: false,
    canManageInvoices: true,
    canViewFinanceReports: true,
    canEditSEO: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: false,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  VIEWER: {
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canEditInventory: false,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canEditSEO: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  INVESTOR: {
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canEditInventory: false,
    canManageInvoices: false,
    canViewFinanceReports: true,
    canEditSEO: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: true,
    isInvestorRestricted: true, // Specifically blocks SKU-level cost and individual supplier details
  },
};
