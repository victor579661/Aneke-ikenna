export type UserRole = 'admin' | 'worker' | 'manager' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string;
  photoURL?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface Appointment {
  id: string;
  userId: string;
  userName: string;
  managerId: string;
  managerName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface Report {
  id: string;
  workerId: string;
  workerName: string;
  title: string;
  content: string;
  createdAt: string;
}
