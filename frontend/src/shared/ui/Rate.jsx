import { Rate } from "antd";

// `color` overrides the default amber. The profile screens pass the design's
// #FFB73A so the stars match the rating bars beside them; everywhere else keeps
// the historical #FEA500.
export default function Ra({ points, size, color }) {
    // Determine the color based on the points value
    const getColor = () => {
        if (color) return points > 0 ? color : "#D9D9D9";
        if (points >= 1 && points < 3) return "#FEA500"; // Between 1 and 2
        if (points === 3) return "#FEA500"; // Exactly 3
        if (points > 3) return "#FEA500"; // Greater than 3
        return "#D9D9D9"; // Default color (optional)
    };

    return (
        <Rate
            disabled
            value={points}
            style={{
                color: getColor(),
                fontSize: size,
                margin: 0,
                padding: 0,
            }}
        />
    );
}
