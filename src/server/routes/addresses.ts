import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
// SessionData type will be augmented by the declaration in auth.ts

const prisma = new PrismaClient();
const router = express.Router();

// Middleware to check for authenticated users
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check relies on the SessionData augmentation from auth.ts
  if (req.session && req.session.user && typeof req.session.user.id === 'number') {
    return next();
  } else {
    return res.status(401).json({ message: 'Unauthorized: Please log in.' });
  }
};

// Apply authentication middleware to all routes in this router
router.use(isAuthenticated);

// --- Address API Endpoints --- 

// GET /api/addresses - Fetch all addresses for the logged-in user
router.get('/', async (req: Request, res: Response) => {
  // The isAuthenticated middleware ensures req.session.user exists and has an id.
  const userId = req.session.user!.id; 

  try {
    const addresses = await prisma.address.findMany({
      where: {
        userId: userId,
      },
      orderBy: [
        { isDefault: 'desc' }, 
        { createdAt: 'asc' }
      ]
    });
    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ message: 'Failed to retrieve addresses.' });
  }
});

// POST /api/addresses - Create a new address for the logged-in user
router.post('/', async (req: Request, res: Response) => {
  // The isAuthenticated middleware ensures req.session.user exists and has an id.
  const userId = req.session.user!.id;
  const {
    type, // Expect 'SHIPPING' or 'BILLING'
    streetAddress,
    city,
    state,
    postalCode,
    country,
    isDefault // boolean, optional
  } = req.body;

  // Basic Validation
  if (!type || !streetAddress || !city || !state || !postalCode || !country) {
    return res.status(400).json({ message: 'Missing required address fields.' });
  }

  // Validate AddressType enum
  if (type !== 'SHIPPING' && type !== 'BILLING') {
    return res.status(400).json({ message: 'Invalid address type. Must be SHIPPING or BILLING.' });
  }

  try {
    // If setting as default, potentially unset other defaults of the same type first
    // Transaction ensures atomicity: unset existing default + create new default
    if (isDefault === true) {
      await prisma.$transaction(async (tx) => {
        // Unset other defaults of the same type for this user
        await tx.address.updateMany({
          where: {
            userId: userId,
            type: type,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });

        // Create the new address as the default
        const newAddress = await tx.address.create({
          data: {
            userId: userId,
            type: type,
            streetAddress: streetAddress,
            city: city,
            state: state,
            postalCode: postalCode,
            country: country,
            isDefault: true, // Set as default
          },
        });
        res.status(201).json(newAddress);
      });
    } else {
      // Create the new address without setting it as default
      const newAddress = await prisma.address.create({
        data: {
          userId: userId,
          type: type,
          streetAddress: streetAddress,
          city: city,
          state: state,
          postalCode: postalCode,
          country: country,
          isDefault: false, // Explicitly false or rely on schema default
        },
      });
      res.status(201).json(newAddress);
    }

  } catch (error) {
    console.error('Error creating address:', error);
    // Handle potential Prisma errors (e.g., unique constraint if needed)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: Handle specific Prisma errors if necessary
      // if (error.code === 'P2002') { ... }
    }
    res.status(500).json({ message: 'Failed to create address.' });
  }
});

// PUT /api/addresses/:addressId - Update an existing address
router.put('/:addressId', async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { addressId } = req.params;
  const {
    type,
    streetAddress,
    city,
    state,
    postalCode,
    country,
    isDefault
  } = req.body;

  // Validate addressId
  const id = parseInt(addressId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid address ID format.' });
  }

  // Basic validation: Ensure at least one field is being updated
  if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'No update data provided.' });
  }

  // Validate AddressType enum if provided
  if (type && type !== 'SHIPPING' && type !== 'BILLING') {
    return res.status(400).json({ message: 'Invalid address type. Must be SHIPPING or BILLING.' });
  }

  try {
    // Use transaction to ensure atomicity
    const updatedAddress = await prisma.$transaction(async (tx) => {
      // 1. Find the address to ensure it exists and belongs to the user
      const existingAddress = await tx.address.findUnique({
        where: { id: id },
      });

      if (!existingAddress) {
        throw new Error('AddressNotFound'); // Custom error type for handling
      }

      if (existingAddress.userId !== userId) {
        throw new Error('Forbidden'); // Custom error type for handling
      }

      // 2. If setting as default, unset other defaults of the same type
      if (isDefault === true && !existingAddress.isDefault) {
        await tx.address.updateMany({
          where: {
            userId: userId,
            type: type || existingAddress.type, // Use new type if provided, else existing
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // 3. Update the address
      const addressUpdateData: Prisma.AddressUpdateInput = {};
      if (type !== undefined) addressUpdateData.type = type;
      if (streetAddress !== undefined) addressUpdateData.streetAddress = streetAddress;
      if (city !== undefined) addressUpdateData.city = city;
      if (state !== undefined) addressUpdateData.state = state;
      if (postalCode !== undefined) addressUpdateData.postalCode = postalCode;
      if (country !== undefined) addressUpdateData.country = country;
      if (isDefault !== undefined) addressUpdateData.isDefault = isDefault;

      // If isDefault is explicitly set to false, and it was the default,
      // we don't need to automatically set another one as default here.
      // That might be a separate UI/UX decision.

      const result = await tx.address.update({
        where: {
          id: id,
          // Redundant check, but good practice inside transaction
          userId: userId 
        },
        data: addressUpdateData,
      });

      return result;
    });

    res.status(200).json(updatedAddress);

  } catch (error: any) {
    console.error('Error updating address:', error);
    if (error.message === 'AddressNotFound') {
      return res.status(404).json({ message: 'Address not found.' });
    }
    if (error.message === 'Forbidden') {
      // Use 403 or 404 to avoid revealing existence
      return res.status(404).json({ message: 'Address not found or access denied.' }); 
    }
    // Handle potential Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // e.g., if update fails validation defined in schema
    }
    res.status(500).json({ message: 'Failed to update address.' });
  }
});

// DELETE /api/addresses/:addressId - Delete an address
router.delete('/:addressId', async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { addressId } = req.params;

  // Validate addressId
  const id = parseInt(addressId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid address ID format.' });
  }

  try {
    // 1. Find the address to ensure it exists and belongs to the user BEFORE deleting
    const existingAddress = await prisma.address.findUnique({
      where: { id: id },
    });

    if (!existingAddress) {
      // Use 404 to indicate not found
      return res.status(404).json({ message: 'Address not found.' });
    }

    if (existingAddress.userId !== userId) {
      // Use 404 (or 403) to avoid revealing existence to unauthorized users
      return res.status(404).json({ message: 'Address not found or access denied.' }); 
    }

    // 2. Delete the address if ownership is verified
    await prisma.address.delete({
      where: {
        id: id,
        // Optional: Can add userId here again for extra safety, 
        // but the check above already covers it.
        // userId: userId 
      },
    });

    // Success: Return 204 No Content
    res.status(204).send(); 

  } catch (error) {
    console.error('Error deleting address:', error);
    // Handle potential Prisma errors if needed (e.g., constraint issues if deletion fails)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle specific errors if necessary
    }
    res.status(500).json({ message: 'Failed to delete address.' });
  }
});

// PUT /api/addresses/:addressId/default - Set an address as default
router.put('/:addressId/default', async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { addressId } = req.params;

  // Validate addressId
  const id = parseInt(addressId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid address ID format.' });
  }

  try {
    const updatedDefaultAddress = await prisma.$transaction(async (tx) => {
      // 1. Find the address to be set as default, verify ownership
      const targetAddress = await tx.address.findUnique({
        where: { id: id },
      });

      if (!targetAddress) {
        throw new Error('AddressNotFound');
      }

      if (targetAddress.userId !== userId) {
        throw new Error('Forbidden');
      }

      // If it's already the default, no action needed
      if (targetAddress.isDefault) {
        return targetAddress; // Return the existing address
      }

      // 2. Unset the default flag on any other address of the same type for this user
      await tx.address.updateMany({
        where: {
          userId: userId,
          type: targetAddress.type, // Only unset for the same type (SHIPPING or BILLING)
          isDefault: true,          // Only target the current default
        },
        data: {
          isDefault: false,
        },
      });

      // 3. Set the target address as the default
      const newDefault = await tx.address.update({
        where: {
          id: id,
          userId: userId, // Ensure we only update if it still belongs to the user
        },
        data: {
          isDefault: true,
        },
      });

      return newDefault;
    });

    res.status(200).json(updatedDefaultAddress);

  } catch (error: any) {
    console.error('Error setting default address:', error);
    if (error.message === 'AddressNotFound') {
      return res.status(404).json({ message: 'Address not found.' });
    }
    if (error.message === 'Forbidden') {
      return res.status(404).json({ message: 'Address not found or access denied.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors if needed
    }
    res.status(500).json({ message: 'Failed to set default address.' });
  }
});

export default router; 