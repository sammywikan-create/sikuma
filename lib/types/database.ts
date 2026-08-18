export type UserRole = 'marketing' | 'kacab' | 'admin';

export type VisitType =
  | 'prospek_baru'
  | 'nasabah_existing'
  | 'penagihan'
  | 'survei_jaminan'
  | 'maintenance';

export type ProductType = 'tabungan' | 'deposito' | 'kredit' | 'lainnya';

export type OutcomeType =
  | 'berminat'
  | 'follow_up'
  | 'realisasi'
  | 'tidak_berminat'
  | 'tidak_ditemui';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  marketing_code: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Visit {
  id: string;
  client_uuid: string;
  marketing_id: string;
  customer_name: string;
  visit_type: VisitType;
  product: ProductType;
  outcome: OutcomeType;
  potential_value: number | null;
  notes: string | null;
  captured_at: string;
  received_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  address: string | null;
  anomaly_flags: string[];
  is_late: boolean;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  verifier_note: string | null;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  storage_path: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  sort_order: number;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string; role: UserRole };
        Update: Partial<Profile>;
        Relationships: [];
      };
      visits: {
        Row: Visit;
        Insert: {
          client_uuid: string;
          marketing_id: string;
          customer_name: string;
          visit_type: VisitType;
          product: ProductType;
          outcome: OutcomeType;
          potential_value?: number | null;
          notes?: string | null;
          captured_at: string;
          received_at?: string;
          lat: number;
          lng: number;
          accuracy_m: number;
          address?: string | null;
          anomaly_flags?: string[];
          is_late?: boolean;
          verification_status?: VerificationStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          verifier_note?: string | null;
        };
        Update: Partial<Visit>;
        Relationships: [];
      };
      visit_photos: {
        Row: VisitPhoto;
        Insert: {
          visit_id: string;
          storage_path: string;
          bytes?: number | null;
          width?: number | null;
          height?: number | null;
          sha256?: string | null;
          sort_order?: number;
        };
        Update: Partial<VisitPhoto>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLog;
        Insert: {
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          payload?: Record<string, unknown> | null;
        };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSetting;
        Insert: { key: string; value: unknown };
        Update: Partial<AppSetting>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
