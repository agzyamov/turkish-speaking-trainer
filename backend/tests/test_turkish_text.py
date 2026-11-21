"""Turkish text policy (constraint C-17, ADR-0004)."""
import pytest

from app.services.turkish_text import (
    canonical_form,
    has_unexpected_letter_script,
    latin_for_evaluation,
    normalized_words,
    turkish_lower,
)


@pytest.mark.parametrize(("text", "expected"), [
    ("ISPARTA", "ısparta"), ("İSTANBUL", "istanbul"), ("Iğdır", "ığdır"), ("İyi", "iyi"),
    ("ÇĞÖŞÜ", "çğöşü"), ("DİKKAT", "dikkat"), ("KIZ", "kız"),
])
def test_lowercasing_follows_turkish_rules(text, expected):
    assert turkish_lower(text) == expected


def test_dotted_and_dotless_i_are_different_letters():
    assert normalized_words("Kız") != normalized_words("Kiz")
    assert normalized_words("AÇIK") == normalized_words("açık")
    assert normalized_words("AÇİK") != normalized_words("açık")


def test_combining_dot_form_of_i_is_recognised():
    assert turkish_lower("İstanbul") == "istanbul"
    assert normalized_words("i̇yi") == "iyi"


@pytest.mark.parametrize(("left", "right"), [
    ("Kâr ettik.", "kar ettik"), ("hâlâ", "hala"), ("Ankara'ya gidiyorum.", "Ankaraya gidiyorum"),
    ("Ali’nin evi", "Alinin evi"), ("  Merhaba,   nasılsın? ", "merhaba nasılsın"), ("Teşekkür ederim!", "TEŞEKKÜR EDERİM"),
])
def test_equivalent_spellings_compare_equal(left, right):
    assert normalized_words(left) == normalized_words(right)


@pytest.mark.parametrize(("left", "right"), [("gül", "gul"), ("şık", "sık"), ("ölü", "olu"), ("çay", "cay"), ("dağ", "dag")])
def test_turkish_letters_are_not_folded_to_ascii(left, right):
    assert normalized_words(left) != normalized_words(right)


def test_unicode_forms_are_unified_without_changing_letters():
    decomposed = "şeker"  # s + combining cedilla
    assert canonical_form(decomposed) == "şeker" and normalized_words(decomposed) == "şeker"


@pytest.mark.parametrize("text", ["Hesap açmak istiyorum.", "Çok güzel, teşekkürler!", "kâğıt", "Taxi, WhatsApp, quiz", "42 lira"])
def test_latin_text_is_expected(text):
    assert has_unexpected_letter_script(text) is False


# The last four are Latin-script compatibility forms; frontend/src/turkishText.ts rejects the same ones.
@pytest.mark.parametrize("text", ["Привет", "Hesap открыть", "مرحبا", "Γειά", "Želim račun и ещё", "ªbc", "ｇüzel", "ᵃçmak", "ⁱyi"])
def test_other_scripts_are_flagged(text):
    assert has_unexpected_letter_script(text) is True


def test_lookalike_cyrillic_inside_a_latin_word_is_repaired_for_comparison():
    mixed = "hesаp"  # Cyrillic а typed on a Russian keyboard
    assert has_unexpected_letter_script(mixed) is True
    assert latin_for_evaluation(mixed) == "hesap" and normalized_words(mixed) == "hesap"


def test_a_cyrillic_word_is_left_visible_not_silently_converted():
    assert latin_for_evaluation("счёт") == "счёт"
    assert normalized_words("hesap счёт") == "hesap счёт"
