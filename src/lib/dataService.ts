import { localDB } from './db';
import { SyncService } from './syncService';

export class DataService {
  /**
   * Universal create method for offline-first operations
   */
  static async create(collectionName: string, data: any) {
    const id = data.id || crypto.randomUUID();
    const now = Date.now();
    
    const enrichedData = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    };

    const table = (localDB as any)[collectionName];
    if (!table) throw new Error(`Table ${collectionName} not found in localDB`);

    await table.add(enrichedData);
    
    // Trigger targeted sync immediately if online
    if (navigator.onLine) {
      // In background, don't wait for cloud to resolve for local smoothness
      SyncService.pushItem(collectionName, enrichedData);
    }
    
    return id;
  }

  /**
   * Universal update method
   */
  static async update(collectionName: string, id: string, data: any) {
    const table = (localDB as any)[collectionName];
    if (!table) throw new Error(`Table ${collectionName} not found in localDB`);

    const now = Date.now();
    const updatePayload = {
      ...data,
      updatedAt: now,
      syncStatus: 'pending'
    };
    
    await table.update(id, updatePayload);
    
    if (navigator.onLine) {
      // We need the full item for pushItem
      const fullItem = await table.get(id);
      if (fullItem) {
        SyncService.pushItem(collectionName, fullItem);
      }
    }
  }

  /**
   * Universal delete method with offline tracking
   */
  static async delete(collectionName: string, id: string) {
    const table = (localDB as any)[collectionName];
    if (!table) throw new Error(`Table ${collectionName} not found in localDB`);

    await table.delete(id);
    await localDB.deletedItems.add({
      id,
      collectionName,
      deletedAt: Date.now()
    });
    
    if (navigator.onLine) {
      // Deletions are still handled by the periodic/manual syncAll or a specific call
      SyncService.syncAll(); 
    }
  }

  /**
   * Offline-compatible sequential ID generator (e.g. for MRN)
   */
  static async getNextSequentialId(counterId: string, prefix: string = ''): Promise<string> {
    return await localDB.transaction('rw', localDB.counters, async () => {
      const counter = await localDB.counters.get(counterId);
      const nextId = (counter?.value || 0) + 1;
      await localDB.counters.put({ id: counterId, value: nextId });
      return `${prefix}${nextId.toString().padStart(5, '0')}`;
    });
  }
}
