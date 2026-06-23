import { loadStripe } from '@stripe/stripe-js';

export const redirectToCheckout = async (sessionId: string): Promise<void> => {
  const publishableKey = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_PUBLISHABLE_KEY is not configured');
  }

  const clientStripe = await loadStripe(publishableKey);

  if (!clientStripe) {
    throw new Error('Failed to load Stripe.js');
  }

  await clientStripe.redirectToCheckout({ sessionId });
};
