export type RoomStatus = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
export type TenantStatus = 'ACTIVE' | 'NOTICE_PERIOD' | 'MOVED_OUT';
export type DocumentType = 'AADHAR_CARD' | 'RENTAL_AGREEMENT' | 'TENANT_PHOTO' | 'POLICE_VERIFICATION' | 'OTHER';
export type PaymentMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentReceiver = 'LANDLORD' | 'CARETAKER';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';

export interface Room {
  id: string;
  room_number: string;
  floor: number;
  base_rent: number;
  security_deposit: number;
  status: RoomStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: string;
  room_id: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  move_in_date: string;
  lease_end_date: string;
  actual_move_out_date?: string | null;
  monthly_rent: number;
  security_deposit_paid: number;
  status: TenantStatus;
  created_at?: string;
  updated_at?: string;
  room?: Room;
}

export interface DocumentRecord {
  id: string;
  tenant_id: string;
  room_id?: string | null;
  doc_type: DocumentType;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  room_id: string;
  billing_period_month: string;
  amount_due: number;
  amount_paid: number;
  amount_pending: number;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_method: PaymentMethod | null;
  received_by: PaymentReceiver;
  transaction_ref?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  tenant?: Tenant;
  room?: Room;
}
