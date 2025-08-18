declare type AppResult =
  | { success: true; data: any }
  | { success: false; error: string; }
