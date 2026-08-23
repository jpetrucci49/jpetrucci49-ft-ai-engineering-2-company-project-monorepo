"""Incident CSV aggregate analysis (M5)."""

from __future__ import annotations

import pandas as pd

from app.incidents.csv_validation import (
    BREAKDOWN_RULES,
    CATEGORIES,
    COUNTRIES,
    INVALID_RULE_LABELS,
    STATUSES,
    load_incidents_from_bytes,
    load_incidents_from_path,
    parse_score,
    text_value,
    validate_columns,
    validate_record,
)

SCORE_LABELS = {
    1: "Very dissatisfied",
    2: "Dissatisfied",
    3: "Neutral",
    4: "Satisfied",
    5: "Very satisfied",
}


def analyze(df: pd.DataFrame) -> dict:
    total = len(df)
    invalid_counts = {rule: 0 for rule in INVALID_RULE_LABELS}
    valid_rows: list[pd.Series] = []

    for _, row in df.iterrows():
        violations = validate_record(row)
        if violations:
            for rule in violations:
                invalid_counts[rule] += 1
        else:
            valid_rows.append(row)

    valid_df = pd.DataFrame(valid_rows)
    valid_count = len(valid_df)
    invalid_count = total - valid_count

    def pct(count: int) -> float:
        if valid_count == 0:
            return 0.0
        return round(count / valid_count * 100, 1)

    category_counts = {cat: 0 for cat in CATEGORIES}
    status_counts = {status: 0 for status in STATUSES}
    country_counts = {country: 0 for country in COUNTRIES}
    score_counts = {score: 0 for score in range(1, 6)}

    closed_total = 0
    scored_total = 0
    score_sum = 0

    if valid_count > 0:
        for _, row in valid_df.iterrows():
            category_counts[text_value(row["category"])] += 1
            status_counts[text_value(row["status"])] += 1
            country_counts[text_value(row["country"])] += 1

            if text_value(row["status"]) == "CLOSED":
                closed_total += 1
                score = parse_score(row["satisfaction_score"])
                if isinstance(score, int):
                    scored_total += 1
                    score_sum += score
                    score_counts[score] += 1

    average_score = round(score_sum / scored_total, 2) if scored_total else 0.0

    return {
        "total": total,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "invalid_counts": invalid_counts,
        "category_counts": category_counts,
        "category_pct": {cat: pct(category_counts[cat]) for cat in CATEGORIES},
        "status_counts": status_counts,
        "status_pct": {status: pct(status_counts[status]) for status in STATUSES},
        "country_counts": country_counts,
        "country_pct": {country: pct(country_counts[country]) for country in COUNTRIES},
        "closed_total": closed_total,
        "scored_total": scored_total,
        "average_score": average_score,
        "score_counts": score_counts,
    }


def metrics_to_csv_rows(metrics: dict) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = [
        {"metric": "total_records", "value": metrics["total"], "percentage": ""},
        {"metric": "valid_records", "value": metrics["valid_count"], "percentage": ""},
        {
            "metric": "invalid_records",
            "value": metrics["invalid_count"],
            "percentage": "",
        },
    ]

    for rule in INVALID_RULE_LABELS:
        rows.append(
            {
                "metric": f"invalid.{rule}",
                "value": metrics["invalid_counts"][rule],
                "percentage": "",
            }
        )

    for category in CATEGORIES:
        rows.append(
            {
                "metric": f"category.{category.lower()}",
                "value": metrics["category_counts"][category],
                "percentage": metrics["category_pct"][category],
            }
        )

    for status in STATUSES:
        rows.append(
            {
                "metric": f"status.{status.lower()}",
                "value": metrics["status_counts"][status],
                "percentage": metrics["status_pct"][status],
            }
        )

    for country in COUNTRIES:
        rows.append(
            {
                "metric": f"country.{country.lower()}",
                "value": metrics["country_counts"][country],
                "percentage": metrics["country_pct"][country],
            }
        )

    rows.extend(
        [
            {
                "metric": "satisfaction.scored_cases",
                "value": metrics["scored_total"],
                "percentage": "",
            },
            {
                "metric": "satisfaction.closed_total",
                "value": metrics["closed_total"],
                "percentage": "",
            },
            {
                "metric": "satisfaction.average",
                "value": metrics["average_score"],
                "percentage": "",
            },
        ]
    )

    for score in range(1, 6):
        rows.append(
            {
                "metric": f"satisfaction.score_{score}",
                "value": metrics["score_counts"][score],
                "percentage": "",
            }
        )

    return rows


def metrics_to_csv_string(metrics: dict) -> str:
    return pd.DataFrame(metrics_to_csv_rows(metrics)).to_csv(index=False)
