/**
 * Simple IoC container for dependency injection
 */
export class Container {
  private services: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();
  
  /**
   * Register a service instance with the container
   * @param name Service name
   * @param instance Service instance
   */
  register<T>(name: string, instance: T): void {
    if (this.services.has(name)) {
      console.warn(`Service '${name}' is being overwritten in the container`);
    }
    
    this.services.set(name, instance);
  }
  
  /**
   * Register a factory function to create a service on demand
   * @param name Service name
   * @param factory Factory function to create the service
   */
  registerFactory<T>(name: string, factory: () => T): void {
    if (this.factories.has(name)) {
      console.warn(`Factory for '${name}' is being overwritten in the container`);
    }
    
    this.factories.set(name, factory);
  }
  
  /**
   * Resolve a service by name
   * @param name Service name
   * @returns Service instance
   * @throws Error if service not found
   */
  resolve<T>(name: string): T {
    // Check if the service is already registered
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }
    
    // Check if there's a factory for this service
    if (this.factories.has(name)) {
      const factory = this.factories.get(name)!;
      const instance = factory();
      
      // Cache the instance for future resolves
      this.services.set(name, instance);
      
      return instance as T;
    }
    
    throw new Error(`Service '${name}' not registered in container`);
  }
  
  /**
   * Check if a service is registered
   * @param name Service name
   * @returns Whether the service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }
  
  /**
   * Remove a service from the container
   * @param name Service name
   */
  remove(name: string): void {
    this.services.delete(name);
    this.factories.delete(name);
  }
  
  /**
   * Create a child container that inherits services from parent
   * @returns Child container
   */
  createChildContainer(): Container {
    const child = new Container();
    
    // Copy all services to the child
    for (const [name, service] of this.services.entries()) {
      child.register(name, service);
    }
    
    // Copy all factories to the child
    for (const [name, factory] of this.factories.entries()) {
      child.registerFactory(name, factory);
    }
    
    return child;
  }
}

// Export a singleton container instance
export const container = new Container(); 