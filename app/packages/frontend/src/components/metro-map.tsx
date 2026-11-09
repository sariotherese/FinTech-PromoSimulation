import { cities } from '../lib/demo-data';
import geography from '../lib/metro-map.json';

export interface CitySummary {
  name: string;
  revenue: number;
  profit: number;
  spend: number;
  promotions: number;
  drafts: number;
}

export function MetroMap({ summaries, selected, metric, onSelect }: {
  summaries: CitySummary[];
  selected: string;
  metric: 'revenue' | 'profit' | 'promotions';
  onSelect: (name: string) => void;
}) {
  const max = Math.max(...summaries.map(city => Math.abs(city[metric])), 1);
  return <svg viewBox="0 0 540 565" className="metro-map" role="group" aria-label="Metro Manila city heat map">
    <text x="30" y="350" className="map-water">MANILA BAY</text>
    <text x="480" y="34" className="map-north">N ↑</text>
    {geography.paths.map(city => {
      const summary = summaries.find(s => s.name === city.name);
      if (!summary) throw new Error(`Missing city data: ${city.name}`);
      const strength = 0.18 + Math.abs(summary[metric]) / max * 0.72;
      return <path key={city.name} d={city.path} fillRule="evenodd" tabIndex={0} role="button"
        aria-label={`${city.name}: ${summary.promotions} reference promotions, ${summary.drafts} saved store drafts`}
        aria-pressed={selected === city.name}
        className={`city-shape ${selected === city.name ? 'selected' : ''}`}
        style={{ fill: summary[metric] < 0 ? 'var(--cp-danger)' : 'var(--cp-accent)', fillOpacity: strength }}
        onClick={() => onSelect(city.name)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(city.name); }
        }}>
        <title>{city.name}: {metric === 'promotions' ? summary.promotions : new Intl.NumberFormat('en-PH', {
          style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
        }).format(summary[metric])}</title>
      </path>;
    })}
    {cities.map(city => {
      const x = geography.offsetX + (city.lon - geography.minX) * geography.longitudeScale * geography.scale;
      const y = geography.offsetY + (geography.maxY - city.lat) * geography.scale;
      const labelX = city.name === 'Navotas' ? x - 65 : x;
      const labelY = city.name === 'Navotas' ? y + 20 : y;
      return <g key={city.name} pointerEvents="none">
        {city.name === 'Navotas' && <line className="map-leader" x1={x} y1={y} x2={labelX + 25} y2={labelY - 4} />}
        <text x={labelX} y={labelY} className="map-label" textAnchor="middle">{city.name}</text>
      </g>;
    })}
  </svg>;
}
