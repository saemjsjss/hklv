/** One student = one spreadsheet row. */
export interface Student {
  rowNum: number;
  applyCourse: string;
  accountEmail: string;
  password: string; // blank in the sheet => generated at fill time
  folder: string;
  studentEmail: string;
  givenName: string;
  familyName: string;
  gender: string;
  nationality: string;
  dob: string;
  passportNo: string;
  noPassport: string; // 'YES' => tick "여권번호 없음"
  homeCountryAddress: string;
  addressKorea: string;
  homeCountryPhone: string;
  messengerType: string;
  messengerId: string;
  mobileKR: string;
  hanyangId: string;
  prefLanguage: string;
  schoolName: string;
  eduCompletionDate: string;
  highestEdu: string;
  visaApplying: string;
  visaType: string;
  visaNo: string;
  visaExpiry: string;
  homeAddress: string;
  homeLandline: string;
  [k: string]: string | number;
}

export type FieldKind = 'text' | 'select' | 'date' | 'checkbox' | 'phone3';

/** A spreadsheet field mapped to a labelled control on the form. */
export interface FormField {
  key: keyof Student & string;
  /** Exact Korean row label on the form. */
  label: string;
  kind: FieldKind;
  /** Which control in the row when a row has several (0-based). */
  index?: number;
}

/** A file upload: standard filename base in the student's folder -> form label. */
export interface FileField {
  label: string;
  base: string; // e.g. 'photo' resolves photo.jpg / photo.jpeg / photo.png
}
