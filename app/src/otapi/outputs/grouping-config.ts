import {
  TypedJSON,
  jsonArrayMember,
  jsonObject,
  jsonSetMember,
} from "typedjson";

@jsonObject
export class GroupingRule {
  @jsonSetMember(String, { name: "groups" })
  public groups: Set<string> = new Set();

  @jsonSetMember(String, { name: "train-ids" })
  public trainIDs: Set<string> = new Set();

  @jsonArrayMember(RegExp, {
    name: "train-id-res",
    deserializer(json: string[]): RegExp[] {
      return json.map((reString): RegExp => new RegExp(reString, "u"));
    },
  })
  public trainIDREs: RegExp[] = [];
}

@jsonObject
export class GroupingConfig {
  @jsonSetMember(String, { name: "groups-for-all-trains" })
  public groupsForAllTrains: Set<string> = new Set(["total"]);

  @jsonArrayMember(GroupingRule, { name: "rules" })
  public rules: GroupingRule[] = [];
}

export const groupingConfigSerializer = new TypedJSON(GroupingConfig);
