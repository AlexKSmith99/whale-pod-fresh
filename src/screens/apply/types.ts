// Shared types for the Application / Waitlist signup flow.

export interface ApplyData {
  firstName: string;
  lastName: string;
  gender: 'Man' | 'Woman' | '';
  email: string;
  emailConfirm: string;
  username: string;
  password: string;
  passwordConfirm: string;
  birthday: Date | null;
  podTypes: string[]; // pod TYPES the applicant is interested in
  podCategories: string[]; // pod CATEGORIES the applicant is interested in
  photos: string[]; // local image URIs (uploaded on submit)
  selfieUri: string | null; // local selfie URI (uploaded on submit)
  profilePicIndex: number; // index into photos chosen as the profile picture
}

export const EMPTY_APPLY_DATA: ApplyData = {
  firstName: '',
  lastName: '',
  gender: '',
  email: '',
  emailConfirm: '',
  username: '',
  password: '',
  passwordConfirm: '',
  birthday: null,
  podTypes: [],
  podCategories: [],
  photos: [],
  selfieUri: null,
  profilePicIndex: 0,
};

export interface StepProps {
  data: ApplyData;
  update: (patch: Partial<ApplyData>) => void;
  onNext: () => void;
  onBack: () => void;
  stepIndex: number; // 1-based, for the "X of N" pill
  stepCount: number;
  submitting?: boolean; // true while the final step is creating the account
}
