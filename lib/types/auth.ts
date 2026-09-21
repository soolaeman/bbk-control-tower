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
  // 1. Executive Overview
  canViewOverview?: boolean;
  canEditOverview?: boolean;

  // 2. Master Inventory
  canViewInventory?: boolean;
  canEditInventory?: boolean;

  // 3. Sales & WA Pitch
  canViewSalesPitch?: boolean;
  canEditSalesPitch?: boolean;

  // 4. Pipeline & QC Funnel
  canViewPipeline?: boolean;
  canEditPipeline?: boolean;

  // 5. Invoices & Dokumen Resmi
  canViewInvoices?: boolean;
  canEditInvoices?: boolean;

  // 6. Financials & Cashflow
  canViewFinancials?: boolean;
  canEditFinancials?: boolean;

  // 7. Warehouse Intelligence
  canViewWarehouses?: boolean;
  canEditWarehouses?: boolean;

  // 8. SEO Quality & Schema
  canViewSEO?: boolean;
  canEditSEO?: boolean;

  // 9. Social Distribution
  canViewSocial?: boolean;
  canEditSocial?: boolean;

  // Legacy / Granular Data Protection Keys
  canViewInternalCost?: boolean;
  canViewFloorPrice?: boolean;
  canViewDealPrice?: boolean;
  canViewTelegramLink?: boolean;
  canViewSupplierData?: boolean;
  canMarkAsSold?: boolean;
  canManageInvoices?: boolean;
  canViewFinanceReports?: boolean;
  canManageSocialMedia?: boolean;
  canViewRawAnalytics?: boolean;
  canAccessInvestorPortal?: boolean;
  isInvestorRestricted?: boolean;

  // Extensible index signature for infinite future tabs & complex filters
  [key: string]: boolean | string[] | number | undefined;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN: {
    canViewOverview: true,
    canEditOverview: true,
    canViewInventory: true,
    canEditInventory: true,
    canViewSalesPitch: true,
    canEditSalesPitch: true,
    canViewPipeline: true,
    canEditPipeline: true,
    canViewInvoices: true,
    canEditInvoices: true,
    canViewFinancials: true,
    canEditFinancials: true,
    canViewWarehouses: true,
    canEditWarehouses: true,
    canViewSEO: true,
    canEditSEO: true,
    canViewSocial: true,
    canEditSocial: true,
    canViewInternalCost: true,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: true,
    canViewSupplierData: true,
    canMarkAsSold: true,
    canManageInvoices: true,
    canViewFinanceReports: true,
    canManageSocialMedia: true,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: true,
    isInvestorRestricted: false,
  },
  FINANCE: {
    canViewOverview: true,
    canEditOverview: false,
    canViewInventory: true,
    canEditInventory: false,
    canViewSalesPitch: true,
    canEditSalesPitch: true,
    canViewPipeline: false,
    canEditPipeline: false,
    canViewInvoices: true,
    canEditInvoices: true,
    canViewFinancials: true,
    canEditFinancials: true,
    canViewWarehouses: false,
    canEditWarehouses: false,
    canViewSEO: false,
    canEditSEO: false,
    canViewSocial: false,
    canEditSocial: false,
    canViewInternalCost: true,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canManageInvoices: true,
    canViewFinanceReports: true,
    canManageSocialMedia: false,
    canViewRawAnalytics: false,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  OPERATOR: {
    canViewOverview: false,
    canEditOverview: false,
    canViewInventory: true,
    canEditInventory: true,
    canViewSalesPitch: true,
    canEditSalesPitch: true,
    canViewPipeline: true,
    canEditPipeline: true,
    canViewInvoices: false,
    canEditInvoices: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canViewWarehouses: true,
    canEditWarehouses: true,
    canViewSEO: false,
    canEditSEO: false,
    canViewSocial: false,
    canEditSocial: false,
    canViewInternalCost: false,
    canViewFloorPrice: true,
    canViewDealPrice: true,
    canViewTelegramLink: true,
    canViewSupplierData: false,
    canMarkAsSold: true,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: false,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  MARKETING: {
    canViewOverview: false,
    canEditOverview: false,
    canViewInventory: true,
    canEditInventory: false,
    canViewSalesPitch: false,
    canEditSalesPitch: false,
    canViewPipeline: false,
    canEditPipeline: false,
    canViewInvoices: false,
    canEditInvoices: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canViewWarehouses: false,
    canEditWarehouses: false,
    canViewSEO: true,
    canEditSEO: true,
    canViewSocial: true,
    canEditSocial: true,
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canManageSocialMedia: true,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
  INVESTOR: {
    canViewOverview: true,
    canEditOverview: false,
    canViewInventory: false,
    canEditInventory: false,
    canViewSalesPitch: false,
    canEditSalesPitch: false,
    canViewPipeline: false,
    canEditPipeline: false,
    canViewInvoices: false,
    canEditInvoices: false,
    canViewFinancials: true,
    canEditFinancials: false,
    canViewWarehouses: false,
    canEditWarehouses: false,
    canViewSEO: false,
    canEditSEO: false,
    canViewSocial: false,
    canEditSocial: false,
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canManageInvoices: false,
    canViewFinanceReports: true,
    canManageSocialMedia: false,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: true,
    isInvestorRestricted: true,
  },
  VIEWER: {
    canViewOverview: false,
    canEditOverview: false,
    canViewInventory: true,
    canEditInventory: false,
    canViewSalesPitch: false,
    canEditSalesPitch: false,
    canViewPipeline: false,
    canEditPipeline: false,
    canViewInvoices: false,
    canEditInvoices: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canViewWarehouses: false,
    canEditWarehouses: false,
    canViewSEO: false,
    canEditSEO: false,
    canViewSocial: false,
    canEditSocial: false,
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    canMarkAsSold: false,
    canManageInvoices: false,
    canViewFinanceReports: false,
    canManageSocialMedia: false,
    canViewRawAnalytics: true,
    canAccessInvestorPortal: false,
    isInvestorRestricted: false,
  },
};
