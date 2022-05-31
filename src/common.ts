import EventEmitter from "events";
import { Contract } from "@ethersproject/contracts";

import { ChainId } from "./chain";
import { Yearn } from "./yearn";
import { Context } from "./context";

/**
 * Generic SDK error, likely caused by internal method calls.
 *
 * // TODO: setup error codes
 */
export class SdkError extends Error {}

export type Address = string;
export type Integer = string;

export type Usdc = string;

export class Service {
  ctx: Context;
  chainId: ChainId;

  events: EventEmitter;

  constructor(chainId: ChainId, ctx: Context) {
    this.chainId = chainId;
    this.ctx = ctx;

    this.events = new EventEmitter();

    // Error handling + update events via proxy / reflection
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

    for (const property of methods) {
      const method = Reflect.get(this, property);
      const path = [this.constructor.name, method.name].join(".");
      Reflect.set(
        this,
        property,
        new Proxy(method, {
          apply: (target, thisArg, argArray) => {
            try {
              const res = target.apply(thisArg, argArray);
              if (res && res instanceof Promise) {
                res
                  .then(result => {
                    try {
                      this.events.emit(method.name, result);
                    } catch (error) {
                      throw new SdkError(`${path} (event listener): ${error.message}`);
                    }
                    return result;
                  })
                  .catch(error => {
                    throw new SdkError(`${path}: ${error.message}`);
                  });
              } else {
                this.events.emit(method.name, res);
              }
              return res;
            } catch (error) {
              throw new SdkError(`${path}: ${error.message}`);
            }
          }
        })
      );
    }
  }
}

export class Reader<T extends ChainId> extends Service {
  protected yearn: Yearn<T>;

  constructor(yearn: Yearn<T>, chainId: T, ctx: Context) {
    super(chainId, ctx);
    this.yearn = yearn;

    // Error handling + update events via proxy / reflection
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

    for (const property of methods) {
      const method = Reflect.get(this, property);
      const path = [this.constructor.name, method.name].join(".");
      Reflect.set(
        this,
        property,
        new Proxy(method, {
          apply: (target, thisArg, argArray) => {
            const cached = this.ctx.cache.get(path, ...argArray);
            if (cached) {
              console.debug(`[SDK] Cache hit ${path}`);
              return cached;
            } else {
              console.debug(`[SDK] Cache miss ${path}`);
            }
            const res = target.apply(thisArg, argArray);
            if (res && res instanceof Promise) {
              res.then(result => {
                this.ctx.cache.set(result, path, ...argArray);
                return result;
              });
            } else {
              this.ctx.cache.set(res, path, ...argArray);
            }
            return res;
          }
        })
      );
    }
  }
}

export class ContractService extends Service {
  static abi: string[] = [];

  address: string;

  contract: Contract;

  constructor(address: Address, chainId: ChainId, ctx: Context) {
    super(chainId, ctx);
    this.address = address;

    this.contract = new Contract(
      this.address,
      // @ts-ignore
      this.constructor.abi,
      ctx.provider
    );
  }
}
