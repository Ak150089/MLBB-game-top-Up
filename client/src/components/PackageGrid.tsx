import type { Package } from "@shared/types";
import PackageCard from "./PackageCard";

interface Props {
  packages: Package[];
  selected: Package | null;
  onSelect: (pkg: Package) => void;
}

export default function PackageGrid({ packages, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
      {packages.map(pkg => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          active={selected?.id === pkg.id}
          onClick={() => onSelect(pkg)}
        />
      ))}
    </div>
  );
}
