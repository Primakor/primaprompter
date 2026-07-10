export type RootStackParamList = {
  Library: undefined;
  Editor: { scriptId?: string } | undefined;
  Record: { scriptId?: string } | undefined;
  Review: { takeId: string; offerDeleteOriginalId?: string };
  Trim: { takeId: string };
  Gallery: { scriptId?: string } | undefined;
  Settings: undefined;
};
