import os
from dotenv import load_dotenv
from groq import Groq


load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL_NAME = "llama-3.3-70b-versatile"


def get_customer_retention_strategy(customer_dict: dict, shap_result: dict) -> list[str]:
    """
    Takes one customer's profile + their SHAP explanation,
    returns 4 specific, actionable retention recommendations.
    """
    increasing = shap_result.get("increasing_risk_factors", [])
    decreasing = shap_result.get("decreasing_risk_factors", [])

    risk_factors_text = "\n".join(
        [f"- {f['explanation']}" for f in increasing]
    ) or "None identified"

    retention_factors_text = "\n".join(
        [f"- {f['explanation']}" for f in decreasing]
    ) or "None identified"

    prompt = f"""You are a customer retention strategist for a telecom company.

Customer profile:
- Contract: {customer_dict.get('Contract')}
- Tenure: {customer_dict.get('tenure')} months
- Monthly Charges: ${customer_dict.get('MonthlyCharges')}
- Internet Service: {customer_dict.get('InternetService')}

Factors increasing this customer's churn risk:
{risk_factors_text}

Factors helping retain this customer:
{retention_factors_text}

Give exactly 4 specific, actionable retention recommendations for THIS customer.
Each recommendation should be one short sentence, directly tied to the risk factors above.
Do not give generic advice. Return ONLY a numbered list of 4 items, nothing else.
"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.4,
    )

    text = response.choices[0].message.content.strip()

    # Parse numbered list into a clean Python list of strings
    recommendations = []
    for line in text.split("\n"):
        line = line.strip()
        if line and (line[0].isdigit()):
            # Remove leading "1.", "2)", etc.
            cleaned = line.lstrip("0123456789.) ").strip()
            if cleaned:
                recommendations.append(cleaned)

    return recommendations[:4] if recommendations else [text]


def get_business_recommendation(insights_summary: dict) -> str:
    """
    Takes auto-calculated business statistics from a batch upload,
    returns ONE overall business recommendation in plain English.
    """
    stats_text = "\n".join([f"- {key}: {value}" for key, value in insights_summary.items()])

    prompt = f"""You are a business analyst for a telecom company reviewing customer churn data.

Here are auto-calculated patterns from a recent batch of customer data:
{stats_text}

Based on these patterns, write ONE overall business recommendation (3-4 sentences)
that a manager could act on. Be specific and reference the actual numbers above.
Return only the recommendation text, nothing else.
"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=250,
        temperature=0.4,
    )

    return response.choices[0].message.content.strip()