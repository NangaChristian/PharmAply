import { fetchApi } from './apiClient';

export const sendEmail = async ({ to, subject, text, html }: { to: string, subject: string, text?: string, html?: string }) => {
  try {
    const res = await fetchApi('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, text, html })
    });
    
    if (!res.ok) {
      throw new Error('Failed to send email API response');
    }
    
    return await res.json();
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error };
  }
};
