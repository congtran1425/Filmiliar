export interface TechnicalPassport {
  passportCode: string;
  serialNumber?: string;
  shutterCount: number;
  sensorCondition: string;
  opticsCondition: string;
  cosmeticGrade: string;
  scratchNotes?: string;
  technicianNotes?: string;
  lastInspectedDate: string;
  isExRental?: boolean;
}

export interface Camera {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  sensorType: string;
  videoResolution: string;
  weightGram: number;
  thumbnailUrl: string;
  baseRentDailyPrice: number;
  baseSalePrice: number;
  conditionPercent: number;
  status: 'AVAILABLE_FOR_RENT' | 'RENTED' | 'AVAILABLE_FOR_SALE' | 'SOLD';
  currentShutter: number;
  depositRequired: number;
  unitsCount?: number;
  passport: TechnicalPassport | null;
}

export interface QuizResult {
  action: 'RENT' | 'BUY';
  matchedCamera: Camera;
  reason: string;
  adviceText: string;
}
