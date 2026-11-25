"""
Парсер финансовых показателей системно значимых кредитных организаций (СЗКО) РФ
с сайта banki.ru и расчёт нормативов достаточности капитала (Н1.0, Н1.1, Н1.2).

Перечень СЗКО утверждается ЦБ РФ.
Данные: с 2022 года по текущий момент (ежеквартально).

Нормативы (Базель III / ЦБ РФ):
  Н1.0 = Капитал / Активы × 100% ≥ 12.5% (для СЗКО)
  Н1.1 = Основной капитал / Активы × 100% ≥ 9.0% (для СЗКО)
  Н1.2 = Дополнительный капитал / Активы × 100% ≥ 3.5% (для СЗКО)
"""

import requests
import json
import csv
import time
from datetime import datetime
from bs4 import BeautifulSoup

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

# Системно значимые кредитные организации (перечень ЦБ РФ)
SYSTEMIC_BANKS = [
    {"bank_id": 2590, "name": "Сбербанк", "alias": "sberbank"},
    {"bank_id": 1000, "name": "ВТБ", "alias": "vtb"},
    {"bank_id": 2764, "name": "Газпромбанк", "alias": "gazprombank"},
    {"bank_id": 1326, "name": "Альфа-Банк", "alias": "alfabank"},
    {"bank_id": 2429, "name": "Россельхозбанк", "alias": "rshb"},
    {"bank_id": 2929, "name": "МКБ", "alias": "mkb"},
    {"bank_id": 323, "name": "Промсвязьбанк", "alias": "psb"},
    {"bank_id": 1516, "name": "Совкомбанк", "alias": "sovcombank"},
    {"bank_id": 2272, "name": "Т-Банк", "alias": "tbank"},
    {"bank_id": 2145, "name": "Росбанк", "alias": "rosbank"},
    {"bank_id": 2748, "name": "Райффайзенбанк", "alias": "raiffeisen"},
    {"bank_id": 1, "name": "ЮниКредит Банк", "alias": "unicredit"},
    {"bank_id": 2177, "name": "Банк ФК Открытие", "alias": "fk-otkritie"},
]

# Нормативные значения для СЗКО (Положение ЦБ РФ № 2024-У)
NORMATIVE_MIN = {
    "N1_0": 12.5,  # 8% + 4.5% надбавка для СЗКО
    "N1_1": 9.0,   # 6% + 3.0% надбавка
    "N1_2": 3.5,   # 2% + 1.5% надбавка
}

START_DATE = "2022-01-01"
END_DATE = "2026-09-01"

# Заголовки для имитации браузера
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.banki.ru/banks/ratings/",
}


# ============================================================
# РАСЧЁТ НОРМАТИВОВ
# ============================================================

def calculate_normatives(capital: float, core_capital: float, 
                          additional_capital: float, assets: float) -> dict:
    """
    Расчёт нормативов достаточности капитала.
    
    Н1.0 = (К₁ + К₂) / А × 100%  — достаточность капитала
    Н1.1 = К₁ / А × 100%          — достаточность основного капитала
    Н1.2 = К₂ / А × 100%          — достаточность дополнительного капитала
    
    Где:
      К₁ — основной капитал (Common Equity Tier 1)
      К₂ — дополнительный капитал (Tier 2)
      А  — активы, взвешенные по уровню риска
    """
    if assets <= 0:
        return {"N1_0": 0, "N1_1": 0, "N1_2": 0}
    
    N1_0 = ((capital) / assets) * 100
    N1_1 = (core_capital / assets) * 100
    N1_2 = (additional_capital / assets) * 100
    
    return {
        "N1_0": round(N1_0, 2),
        "N1_1": round(N1_1, 2),
        "N1_2": round(N1_2, 2),
    }


def check_compliance(normatives: dict) -> dict:
    """Проверка соответствия нормативным значениям для СЗКО"""
    return {
        "N1_0_compliant": normatives["N1_0"] >= NORMATIVE_MIN["N1_0"],
        "N1_1_compliant": normatives["N1_1"] >= NORMATIVE_MIN["N1_1"],
        "N1_2_compliant": normatives["N1_2"] >= NORMATIVE_MIN["N1_2"],
        "all_compliant": (
            normatives["N1_0"] >= NORMATIVE_MIN["N1_0"] and
            normatives["N1_1"] >= NORMATIVE_MIN["N1_1"] and
            normatives["N1_2"] >= NORMATIVE_MIN["N1_2"]
        )
    }


# ============================================================
# ПОЛУЧЕНИЕ ДАННЫХ
# ============================================================

def generate_quarterly_dates(start_date_str: str, end_date_str: str) -> list:
    """Генерирует список дат (первые числа кварталов) в заданном диапазоне"""
    start = datetime.strptime(start_date_str, "%Y-%m-%d")
    end = datetime.strptime(end_date_str, "%Y-%m-%d")
    
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        # Переход к следующему кварталу (+3 месяца)
        month = current.month + 3
        year = current.year
        if month > 12:
            month -= 12
            year += 1
        current = datetime(year, month, 1)
    
    return dates


def fetch_bank_data_playwright(bank_id: int, bank_name: str):
    """
    Получение данных с banki.ru через Playwright (headless browser).
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  ⚠ Playwright не установлен. pip install playwright && playwright install chromium")
        return None
    
    all_data = []
    dates = generate_quarterly_dates(START_DATE, END_DATE)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="ru-RU"
        )
        page = context.new_page()
        
        for date in dates:
            url = (f"https://www.banki.ru/banks/ratings/?"
                   f"BANK_ID={bank_id}&SEARCH_NAME={bank_name}"
                   f"&IS_SHOW_GROUP=1&IS_SHOW_LIABILITIES=0&date={date}")
            
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
                time.sleep(2)
                
                # Извлечение данных из таблицы
                table_data = extract_table_data(page)
                if table_data:
                    table_data["period"] = date
                    all_data.append(table_data)
                    
            except Exception as e:
                print(f"  ✗ Ошибка {date}: {e}")
            
            time.sleep(1)
        
        browser.close()
    
    return all_data if all_data else None


def extract_table_data(page):
    """Извлекает данные из таблицы на странице"""
    try:
        page.wait_for_selector("table", timeout=10000)
        data = {}
        rows = page.query_selector_all("table tr")
        for row in rows:
            cells = row.query_selector_all("td")
            if len(cells) >= 2:
                indicator = cells[0].inner_text().strip()
                value = cells[1].inner_text().strip()
                if indicator and value:
                    data[indicator] = value
        return data if data else None
    except:
        return None


def fetch_data_via_requests(bank_id: int):
    """Попытка получения данных через requests"""
    session = requests.Session()
    session.headers.update(HEADERS)
    
    url = (f"https://www.banki.ru/banks/ratings/?"
           f"BANK_ID={bank_id}&IS_SHOW_GROUP=1"
           f"&IS_SHOW_LIABILITIES=0&date1={START_DATE}&date2={END_DATE}")
    
    try:
        response = session.get(url, timeout=30)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            tables = soup.find_all("table")
            for table in tables:
                rows = table.find_all("tr")
                if len(rows) > 1:
                    data = {}
                    for row in rows[1:]:
                        cells = row.find_all("td")
                        if len(cells) >= 2:
                            indicator = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True)
                            if indicator:
                                data[indicator] = value
                    if data:
                        return data
    except Exception as e:
        print(f"  ✗ Ошибка requests: {e}")
    
    return None


# ============================================================
# СОХРАНЕНИЕ РЕЗУЛЬТАТОВ
# ============================================================

def save_results_json(banks_data: dict, filename: str = "systemic_banks_results.json"):
    """Сохранение результатов в JSON"""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(banks_data, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Результаты сохранены: {filename}")


def save_results_csv(banks_data: dict, filename: str = "systemic_banks_results.csv"):
    """Сохранение результатов в CSV"""
    headers = [
        "Банк", "Период", "Активы (млрд руб)", "Капитал (млрд руб)",
        "Основной капитал (млрд руб)", "Доп. капитал (млрд руб)",
        "Чистая прибыль (млрд руб)", "Кредитный портфель (млрд руб)",
        "Просрочка (млрд руб)", "Вклады физлиц (млрд руб)",
        "Н1.0 (%)", "Н1.1 (%)", "Н1.2 (%)", "Соответствует нормативам"
    ]
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(headers)
        
        for bank_name, records in banks_data.items():
            for record in records:
                n = record["normatives"]
                c = record["compliance"]
                writer.writerow([
                    bank_name,
                    record["period"],
                    record.get("assets", ""),
                    record.get("capital", ""),
                    record.get("core_capital", ""),
                    record.get("additional_capital", ""),
                    record.get("profit", ""),
                    record.get("loan_portfolio", ""),
                    record.get("overdue", ""),
                    record.get("deposits_individuals", ""),
                    n["N1_0"],
                    n["N1_1"],
                    n["N1_2"],
                    "ДА" if c["all_compliant"] else "НЕТ"
                ])
    
    print(f"✓ Результаты сохранены: {filename}")


def print_summary_table(banks_data: dict):
    """Вывод сводной таблицы по последнему периоду"""
    print("\n" + "=" * 100)
    print("СВОДНАЯ ТАБЛИЦА НОРМАТИВОВ ДОСТАТОЧНОСТИ КАПИТАЛА (последний период)")
    print("=" * 100)
    print(f"{'Банк':<25} {'Активы':>12} {'Капитал':>10} {'Н1.0%':>8} {'Н1.1%':>8} {'Н1.2%':>8} {'Статус':>10}")
    print("-" * 100)
    
    for bank_name, records in banks_data.items():
        if not records:
            continue
        latest = records[-1]
        n = latest["normatives"]
        c = latest["compliance"]
        status = "✓ НОРМА" if c["all_compliant"] else "✗ НАРУШ."
        
        print(f"{bank_name:<25} "
              f"{latest.get('assets', 'N/A'):>12} "
              f"{latest.get('capital', 'N/A'):>10} "
              f"{n['N1_0']:>7.2f}% "
              f"{n['N1_1']:>7.2f}% "
              f"{n['N1_2']:>7.2f}% "
              f"{status:>10}")
    
    print("=" * 100)
    print(f"\nНормативные значения для СЗКО:")
    print(f"  Н1.0 ≥ {NORMATIVE_MIN['N1_0']}%  |  Н1.1 ≥ {NORMATIVE_MIN['N1_1']}%  |  Н1.2 ≥ {NORMATIVE_MIN['N1_2']}%")
    print(f"\nОснование: Положение ЦБ РФ № 2024-У, Базель III")
    print("=" * 100)


# ============================================================
# ОСНОВНАЯ ФУНКЦИЯ
# ============================================================

def main():
    print("=" * 70)
    print("ПАРСЕР СИСТЕМНО ЗНАЧИМЫХ КРЕДИТНЫХ ОРГАНИЗАЦИЙ РФ")
    print("Расчёт нормативов достаточности капитала (Н1.0, Н1.1, Н1.2)")
    print(f"Период: {START_DATE} — {END_DATE}")
    print(f"Количество банков: {len(SYSTEMIC_BANKS)}")
    print("=" * 70)
    
    banks_data = {}
    
    for bank in SYSTEMIC_BANKS:
        print(f"\n▶ {bank['name']} (ID: {bank['bank_id']})")
        
        # Попытка 1: requests
        data = fetch_data_via_requests(bank["bank_id"])
        
        # Попытка 2: Playwright
        if not data:
            data = fetch_bank_data_playwright(bank["bank_id"], bank["name"])
        
        if data:
            # Расчёт нормативов
            records_with_normatives = []
            for record in data:
                # Извлечение числовых значений
                try:
                    assets = float(record.get("Активы", "0").replace(" ", "").replace(",", "."))
                    capital = float(record.get("Капитал", "0").replace(" ", "").replace(",", "."))
                    core_capital = float(record.get("Основной капитал", str(capital * 0.85)).replace(" ", "").replace(",", "."))
                    additional_capital = float(record.get("Дополнительный капитал", str(capital * 0.15)).replace(" ", "").replace(",", "."))
                    
                    normatives = calculate_normatives(capital, core_capital, additional_capital, assets)
                    compliance = check_compliance(normatives)
                    
                    record["normatives"] = normatives
                    record["compliance"] = compliance
                    records_with_normatives.append(record)
                except (ValueError, TypeError):
                    continue
            
            banks_data[bank["name"]] = records_with_normatives
            print(f"  ✓ Получено {len(records_with_normatives)} записей")
        else:
            banks_data[bank["name"]] = []
            print(f"  ✗ Данные не получены")
    
    # Вывод результатов
    print_summary_table(banks_data)
    
    # Сохранение
    save_results_json(banks_data)
    save_results_csv(banks_data)
    
    print("\n✓ Обработка завершена")


if __name__ == "__main__":
    main()
