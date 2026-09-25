export type RoomStatus = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
export type TenantStatus = 'ACTIVE' | 'NOTICE_PERIOD' | 'MOVED_OUT';
export type TenantType = 'BACHELORS' | 'FAMILY';
export type DocumentType = 'AADHAR_CARD' | 'RENTAL_AGREEMENT' | 'TENANT_PHOTO' | 'POLICE_VERIFICATION' | 'ELECTRICITY_BILL' | 'OTHER';
export type PaymentMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentReceiver = 'LANDLORD' | 'CARETAKER' | 'MANAGER' | (string & {});
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
export type PaymentType = 'RENT' | 'MAINTENANCE' | 'SECURITY_DEPOSIT' | 'ELECTRICITY' | 'OTHER';

export interface BachelorOccupant {
  id?: string;
  name: string;
  phone: string;
  occupation: string; // e.g. "Student" or "Software Engineer"
  organization: string; // College or Company name
  role_or_course?: string; // e.g. "B.Tech CSE 3rd Year" or "Backend Developer"
  aadhar_number?: string;
  notes?: string;
}

export interface Room {
  id: string;
  room_number: string;
  floor: number;
  base_rent: number;
  security_deposit: number;
  status: RoomStatus;
  capacity?: number; // Total persons/beds (e.g. 2 sharing, 3 sharing, or 1)
  current_occupancy?: number; // How many currently staying
  can_someone_get_in?: boolean; // Is there a bed/vacancy for someone to move in
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
  tenant_type: TenantType; // 'BACHELORS' or 'FAMILY'
  occupants?: BachelorOccupant[] | null; // Detailed individual list if Bachelors
  family_members_count?: number | null; // Count if Family
  primary_occupation?: string | null; // What they do
  college_or_company?: string | null; // College or workplace
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  move_in_date: string;
  lease_end_date: string;
  actual_move_out_date?: string | null;
  monthly_rent: number;
  security_deposit_paid: number;
  rent_due_day?: number; // Day of the month when rent is due (1-31, e.g. 5th of every month)
  status: TenantStatus;
  created_at?: string;
  updated_at?: string;
  room?: Room | null;
}

export interface DocumentRecord {
  id: string;
  tenant_id: string | null;
  room_id?: string | null;
  doc_type: DocumentType;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string;
  tenant?: Tenant | null;
  room?: Room | null;
  file_data?: string | null;
}

export interface Payment {
  id: string;
  tenant_id: string;
  room_id: string;
  billing_period_month: string;
  billing_month?: string;
  amount_due: number;
  amount_paid: number;
  amount_pending: number;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_method: PaymentMethod | null;
  received_by: PaymentReceiver;
  payment_type?: PaymentType;
  installment_number?: number | null;
  total_target_amount?: number | null;
  transaction_ref?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  tenant?: Tenant;
  room?: Room;
}

