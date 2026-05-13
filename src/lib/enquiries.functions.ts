export const ENQUIRY_TYPES = [
  "inquiry",
  "complaint",
  "new_client",
  "support_request",
  "general_question",
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

async function callApi(action: string, data: any) {
  const response = await fetch('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'API call failed');
  return result;
}

export const submitEnquiry = async (data: any) => {
  return callApi('submit', data);
};

export const listEnquiries = async () => {
  return callApi('list', {});
};

export const updateEnquiryStatus = async (data: { id: string; status: string }) => {
  return callApi('updateStatus', data);
};

export const reanalyzeEnquiry = async (data: { id: string; enquiry_type: string }) => {
  return callApi('reanalyze', data);
};
