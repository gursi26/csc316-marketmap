import pandas as pd

df = pd.read_csv("../cleaned/Company-benefits.csv") 

def classify(df):
    df = df.copy()
    df["desc_lower"] = df["Benefit Description"].str.lower()
    df["cat_lower"] = df["Benefit Category"].str.lower()

    # --- helper ---
    def contains_any(s, keywords):
        s = s.lower()
        return any(k in s for k in keywords)

    # masks for counts
    gym_keywords   = ["gym", "fitness"]
    child_keywords = ["maternity", "fertility", "paternity", "mother", "adoption"]
    roth_keywords  = ["roth", "401k", "employee stock purchase program (espp)", "flexible spending account (fsa)"]
    phone_keywords = ["phone"]

    gym_mask   = df["desc_lower"].apply(lambda x: contains_any(x, gym_keywords))
    child_mask = df["desc_lower"].apply(lambda x: contains_any(x, child_keywords))
    roth_mask  = df["desc_lower"].apply(lambda x: contains_any(x, roth_keywords))
    phone_mask = df["desc_lower"].apply(lambda x: contains_any(x, phone_keywords))

    gym_count   = gym_mask.groupby(df["Ticker"]).sum().to_dict()
    child_count = child_mask.groupby(df["Ticker"]).sum().to_dict()
    roth_count  = roth_mask.groupby(df["Ticker"]).sum().to_dict()
    phone_count = phone_mask.groupby(df["Ticker"]).sum().to_dict()

    df["Screen"]   = ""
    df["IconName"] = ""

    # --- Unique section ---
    unique_mask = df["Benefit Category"].str.startswith("Unique To")
    df.loc[unique_mask, "Screen"] = "unique"

    non_unique = ~unique_mask

    # helper to apply only where Screen still empty
    def apply_where(condition, screen_val, icon_func):
        mask = condition & non_unique & (df["Screen"] == "")
        df.loc[mask, "Screen"] = screen_val
        df.loc[mask, "IconName"] = df.loc[mask].apply(icon_func, axis=1)

    # --- Insurance view ---
    def insurance_icon(row):
        t = row["desc_lower"]
        if "life insurance" in t:
            return "life"
        if "vision insurance" in t:
            return "vision"
        if "health insurance" in t:
            return "health"
        if "dental insurance" in t:
            return "dental"
        if "disability insurance" in t:
            return "disability"
        if "pet insurance" in t:
            return "PET INSURANCE"
        if "business travel" in t and "insurance" in t:
            return "business travel"
        if "ad&d" in t or "accidental death and dismemberment" in t:
            return "AD&D"
        if "auto and home insurance" in t or "auto & home insurance" in t or "personal accident insurance" in t or "accident insurance" in t:
            return "insurance"
        if "insurance" in t:
            return "insurance"
        return ""

    ins_cond = non_unique & df["desc_lower"].str.contains("insurance")
    apply_where(ins_cond, "insurance", insurance_icon)

    # --- Transportation view ---
    def transport_icon(row):
        t = row["desc_lower"]
        if "shuttle" in t:
            return "shuttle"
        if "transit" in t:
            return "transit"
        if "bike" in t:
            return "bike"
        if "transport" in t:
            return "transport"
        return ""

    trans_cond = non_unique & (
        (df["Benefit Category"] == "Transportation")
        | df["desc_lower"].str.contains("transport")
        | df["desc_lower"].str.contains("transit")
        | df["desc_lower"].str.contains("shuttle")
        | df["desc_lower"].str.contains("bike")
    )
    apply_where(trans_cond, "transportation", transport_icon)

    # --- Food view ---
    def food_icon(row):
        t = row["desc_lower"]
        if "breakfast" in t:
            return "breakfast"
        if "lunch" in t:
            return "lunch"
        if "dinner" in t:
            return "dinner"
        if "snack" in t:
            return "snack"
        if "drinks" in t or "drink" in t:
            return "drink"
        return ""

    food_cond = non_unique & (
        df["desc_lower"].str.contains("breakfast")
        | df["desc_lower"].str.contains("lunch")
        | df["desc_lower"].str.contains("dinner")
        | df["desc_lower"].str.contains("snack")
        | df["desc_lower"].str.contains("drinks")
        | df["desc_lower"].str.contains("drink")
    )
    apply_where(food_cond, "food", food_icon)

    # --- Office icons: gym ---
    def gym_icon(row):
        c = gym_count.get(row["Ticker"], 0)
        if c <= 1:
            return "gym1"
        if c == 2:
            return "gym2"
        return "gym3"

    gym_cond = non_unique & gym_mask
    apply_where(gym_cond, "office", gym_icon)

    # --- Office icons: child ---
    def child_icon(row):
        c = child_count.get(row["Ticker"], 0)
        if c <= 1:
            return "child1"
        if c == 2:
            return "child2"
        return "child3"

    child_cond = non_unique & child_mask
    apply_where(child_cond, "office", child_icon)

    # --- Office icons: roth / 401k / ESPP / FSA ---
    def roth_icon(row):
        c = roth_count.get(row["Ticker"], 0)
        if c <= 1:
            return "roth1"
        if c == 2:
            return "roth2"
        return "roth3"

    roth_cond = non_unique & roth_mask
    apply_where(roth_cond, "office", roth_icon)

    # --- Office icons: phone ---
    def phone_icon(row):
        c = phone_count.get(row["Ticker"], 0)
        if c <= 1:
            return "phone1"
        return "phone2"

    phone_cond = non_unique & phone_mask
    apply_where(phone_cond, "office", phone_icon)

    # --- Office icons: pet friendly workplace ---
    pfw_cond = non_unique & df["desc_lower"].str.contains("pet friendly workplace")
    apply_where(pfw_cond, "office", lambda r: "pet friendly WORKPLACE")

    # --- Office icons: tuition / learning ---
    tuition_cond = non_unique & (
        df["desc_lower"].str.contains("tuition")
        | df["desc_lower"].str.contains("learning and development")
    )
    apply_where(tuition_cond, "office", lambda r: "tuition")

    # --- Default: other ---
    df.loc[df["Screen"] == "", "Screen"] = "other"

    return df

classified = classify(df)
classified.to_csv("benefits_classified.csv", index=False)
