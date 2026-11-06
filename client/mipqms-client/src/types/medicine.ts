export interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  dosageForm: string | null;
  strength: string | null;
  stockQuantity: number;
}
