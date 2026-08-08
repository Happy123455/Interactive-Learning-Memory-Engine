export const safeJsonParse = async (res: Response): Promise<any> => {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return {};
  }
};
