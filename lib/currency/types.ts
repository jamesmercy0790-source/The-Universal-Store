export interface ExchangeRateProvider {
  readonly id: string;
  /** Rates are always base=USD, quote=target — matches our internal base currency. */
  fetchRates(quoteCodes: string[]): Promise<Record<string, number>>;
}
