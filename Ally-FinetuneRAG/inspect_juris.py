from datasets import load_dataset

print("Loading Juris dataset in streaming mode...")

ds = load_dataset(
    "bettergovph/gov-library",
    streaming=True
)

count = 0

for record in ds["train"]:
    basename = record.get("basename", "")

    # Only actual G.R. case documents
    if not basename.startswith("gr_"):
        continue

    print("\n" + "=" * 80)

    print("ID:", record.get("id"))
    print("TITLE:", record.get("title"))
    print("YEAR:", record.get("year"))
    print("MONTH:", record.get("month"))
    print("PATH:", record.get("path"))
    print("BASENAME:", record.get("basename"))

    content = record.get("content", "")

    print("CONTENT LENGTH:", len(content))

    print("\nCONTENT PREVIEW:")
    print(content[:1500])

    count += 1

    if count >= 10:
        break

print("\n" + "=" * 80)
print(f"Inspected {count} Juris cases.")