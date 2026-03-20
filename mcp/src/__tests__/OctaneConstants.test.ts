import { describe, it, expect } from 'vitest';
import {
  AttrType,
  AttributeId,
  OBJ_API_ITEM,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM_ARRAY,
  CRASH_TYPE_IDS,
  PIN_TYPE_NAMES,
  RT_PINS,
} from '../../../shared/OctaneConstants';

describe('shared OctaneConstants', () => {
  describe('AttrType', () => {
    it('has correct values matching proto definitions', () => {
      expect(AttrType.AT_BOOL).toBe(1);
      expect(AttrType.AT_INT).toBe(3);
      expect(AttrType.AT_FLOAT).toBe(9);
      expect(AttrType.AT_FLOAT2).toBe(90); // NOT 10
      expect(AttrType.AT_FLOAT3).toBe(11);
      expect(AttrType.AT_STRING).toBe(14);
    });
  });

  describe('AttributeId', () => {
    it('has correct well-known attribute IDs', () => {
      expect(AttributeId.A_VALUE).toBe(185);
      expect(AttributeId.A_FILENAME).toBe(34);
      expect(AttributeId.A_TRANSLATION).toBe(172);
      expect(AttributeId.A_ROTATION).toBe(137);
      expect(AttributeId.A_SCALE).toBe(139);
    });
  });

  describe('ObjectType constants', () => {
    it('has correct object type values', () => {
      expect(OBJ_API_ITEM).toBe(16);
      expect(OBJ_API_NODE).toBe(17);
      expect(OBJ_API_NODE_GRAPH).toBe(20);
      expect(OBJ_API_ITEM_ARRAY).toBe(31);
    });
  });

  describe('CRASH_TYPE_IDS', () => {
    it('blocks known dangerous type IDs', () => {
      expect(CRASH_TYPE_IDS.has(0)).toBe(true);
      expect(CRASH_TYPE_IDS.has(116)).toBe(true);
      expect(CRASH_TYPE_IDS.has(408)).toBe(true);
      expect(CRASH_TYPE_IDS.has(40000)).toBe(true);
    });

    it('does not block normal type IDs', () => {
      expect(CRASH_TYPE_IDS.has(130)).toBe(false); // NT_MAT_UNIVERSAL
      expect(CRASH_TYPE_IDS.has(30)).toBe(false); // NT_GEO_MESH
    });
  });

  describe('PIN_TYPE_NAMES', () => {
    it('maps common pin type IDs to names', () => {
      expect(PIN_TYPE_NAMES[5]).toBe('PT_TEXTURE');
      expect(PIN_TYPE_NAMES[7]).toBe('PT_MATERIAL');
      expect(PIN_TYPE_NAMES[8]).toBe('PT_CAMERA');
      expect(PIN_TYPE_NAMES[12]).toBe('PT_GEOMETRY');
    });
  });

  describe('RT_PINS', () => {
    it('has correct render target pin indices', () => {
      expect(RT_PINS.CAMERA).toBe(0);
      expect(RT_PINS.ENVIRONMENT).toBe(1);
      expect(RT_PINS.GEOMETRY).toBe(3);
      expect(RT_PINS.FILM).toBe(4);
      expect(RT_PINS.KERNEL).toBe(6);
    });
  });
});
