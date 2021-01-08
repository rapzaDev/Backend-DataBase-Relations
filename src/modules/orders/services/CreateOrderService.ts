import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const existingCustomer = await this.customersRepository.findById(
      customer_id,
    );

    if (!existingCustomer) {
      throw new AppError('Invalid user id');
    }

    const storageProducts = await this.productsRepository.findAllById(products);

    if (!storageProducts.length) {
      throw new AppError('Could not find any product with this id', 400);
    }

    const storageProductsIds = storageProducts.map(product => product.id);

    const checkInexistingProducts = products.filter(
      product => !storageProductsIds.includes(product.id),
    );

    if (checkInexistingProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistingProducts[0].id}`,
      );
    }

    const quantityCheck = products.filter(
      product =>
        storageProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (quantityCheck.length) {
      throw new AppError(
        `The quantity ${quantityCheck[0].quantity} is no avaliable for ${quantityCheck[0].id}`,
      );
    }

    const dataProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: storageProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: existingCustomer,
      products: dataProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        storageProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
