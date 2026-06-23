import Stripe from 'stripe';

if (!process.env.PAYMENTS_SECRET_KEY) {
  throw new Error('PAYMENTS_SECRET_KEY is not configured');
}

const stripe = new Stripe(process.env.PAYMENTS_SECRET_KEY, {
  apiVersion: '2022-08-01',
});

export const createCustomer = async (email: string): Promise<Stripe.Customer> =>
  await stripe.customers.create({
    email,
  });

export const getInvoices = async (
  customer: string
): Promise<Stripe.Invoice[] | undefined> => {
  const invoices = await stripe.invoices.list({ customer });
  return invoices?.data;
};

type ProductWithPrice = Stripe.Product & { prices?: Stripe.Price };

export const getProducts = async (): Promise<
  ProductWithPrice[] | undefined
> => {
  const [products, prices] = await Promise.all([
    stripe.products.list(),
    stripe.prices.list(),
  ]);
  const productPrices: Record<string, Stripe.Price> = {};
  prices?.data.forEach((price) => {
    if (typeof price.product === 'string') {
      productPrices[price.product] = price;
    }
  });
  const enriched = products?.data.map((product): ProductWithPrice => {
    const enrichedProduct: ProductWithPrice = product;
    enrichedProduct.prices = productPrices[product.id];
    return enrichedProduct;
  });
  return enriched?.reverse();
};

export default stripe;
