import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY is not set. Email functionality will be disabled.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string; // Subject can often be set in the template, but can be overridden
  templateId: string; 
  dynamicTemplateData: Record<string, any>; // Data to populate the template
  from?: string; // Optional: defaults to a configured sender if not provided
}

const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@abominablecreamery.example'; // Replace with your actual verified sender

/**
 * Sends an email using SendGrid dynamic templates.
 * @param options - Email options including to, subject, templateId, and dynamicTemplateData.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('Attempted to send email without SENDGRID_API_KEY being set.');
    // In a real app, you might throw an error or handle this case differently
    return; 
  }

  const msg = {
    to: options.to,
    from: options.from || DEFAULT_FROM_EMAIL, // Use default sender if not specified
    subject: options.subject, // Subject line
    templateId: options.templateId, // Specify the template ID
    dynamicTemplateData: options.dynamicTemplateData, // Pass dynamic data for the template
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);

    // Log more details if available (e.g., from SendGrid response)
    if ((error as any).response) {
      console.error((error as any).response.body);
    }
    // Re-throw or handle the error appropriately for your application
    throw error; 
  }
}; 