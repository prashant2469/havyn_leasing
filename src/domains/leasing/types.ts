export type PropertyWithUnitsOption = {
  id: string;
  name: string;
  units: { id: string; unitNumber: string }[];
};

export type ListingOption = {
  id: string;
  title: string;
  unit: { unitNumber: string; property: { name: string } };
};
