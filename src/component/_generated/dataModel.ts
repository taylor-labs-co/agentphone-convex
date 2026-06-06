import type { GenericId } from "convex/values";

export type DataModel = any;

export type TableNames = string;

export type Doc<TableName extends TableNames> = Record<string, unknown> & {
  _id: GenericId<TableName>;
  _creationTime: number;
};

export type Id<TableName extends TableNames> = GenericId<TableName>;
