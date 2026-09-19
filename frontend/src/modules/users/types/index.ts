export type UserRole = "MEMBER" | "SERVANT" | "ADMIN";
export type UserStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "BANNED"
  | "INACTIVE";

export interface UserAdminItem {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  public_id: string;
  created_at: string;
  last_login_at: string | null;
  has_password: boolean;
}