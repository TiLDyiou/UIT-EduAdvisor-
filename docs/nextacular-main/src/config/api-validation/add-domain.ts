import isFQDN from 'validator/lib/isFQDN';
import { z } from 'zod';

export const addDomainSchema = z.object({
  domainName: z.string().refine((value) => isFQDN(value), {
    message: 'Domain name must be a fully qualified domain name',
  }),
});

export type AddDomainBody = z.infer<typeof addDomainSchema>;
