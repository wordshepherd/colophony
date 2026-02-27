from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_form_page_body_branching_rules_type_0_item import UpdateFormPageBodyBranchingRulesType0Item





T = TypeVar("T", bound="UpdateFormPageBody")



@_attrs_define
class UpdateFormPageBody:
    """ 
        Attributes:
            title (str | Unset):
            description (str | Unset):
            branching_rules (list[UpdateFormPageBodyBranchingRulesType0Item] | None | Unset):
     """

    title: str | Unset = UNSET
    description: str | Unset = UNSET
    branching_rules: list[UpdateFormPageBodyBranchingRulesType0Item] | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_form_page_body_branching_rules_type_0_item import UpdateFormPageBodyBranchingRulesType0Item
        title = self.title

        description = self.description

        branching_rules: list[dict[str, Any]] | None | Unset
        if isinstance(self.branching_rules, Unset):
            branching_rules = UNSET
        elif isinstance(self.branching_rules, list):
            branching_rules = []
            for branching_rules_type_0_item_data in self.branching_rules:
                branching_rules_type_0_item = branching_rules_type_0_item_data.to_dict()
                branching_rules.append(branching_rules_type_0_item)


        else:
            branching_rules = self.branching_rules


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if title is not UNSET:
            field_dict["title"] = title
        if description is not UNSET:
            field_dict["description"] = description
        if branching_rules is not UNSET:
            field_dict["branchingRules"] = branching_rules

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_form_page_body_branching_rules_type_0_item import UpdateFormPageBodyBranchingRulesType0Item
        d = dict(src_dict)
        title = d.pop("title", UNSET)

        description = d.pop("description", UNSET)

        def _parse_branching_rules(data: object) -> list[UpdateFormPageBodyBranchingRulesType0Item] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                branching_rules_type_0 = []
                _branching_rules_type_0 = data
                for branching_rules_type_0_item_data in (_branching_rules_type_0):
                    branching_rules_type_0_item = UpdateFormPageBodyBranchingRulesType0Item.from_dict(branching_rules_type_0_item_data)



                    branching_rules_type_0.append(branching_rules_type_0_item)

                return branching_rules_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[UpdateFormPageBodyBranchingRulesType0Item] | None | Unset, data)

        branching_rules = _parse_branching_rules(d.pop("branchingRules", UNSET))


        update_form_page_body = cls(
            title=title,
            description=description,
            branching_rules=branching_rules,
        )


        update_form_page_body.additional_properties = d
        return update_form_page_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
