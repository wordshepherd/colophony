from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="UpdatePeriodBody")



@_attrs_define
class UpdatePeriodBody:
    """ 
        Attributes:
            name (str | Unset): Display name for the submission period
            description (str | Unset): Description of the period (max 2,000 chars)
            opens_at (datetime.datetime | Unset): When submissions open (ISO-8601)
            closes_at (datetime.datetime | Unset): When submissions close (ISO-8601)
            fee (float | Unset): Submission fee in cents (omit for free)
            max_submissions (int | Unset): Maximum number of submissions (omit for unlimited)
            form_definition_id (None | Unset | UUID): Form definition to link (null to unlink)
            sim_sub_prohibited (bool | Unset): Whether simultaneous submissions are prohibited (default: false)
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    opens_at: datetime.datetime | Unset = UNSET
    closes_at: datetime.datetime | Unset = UNSET
    fee: float | Unset = UNSET
    max_submissions: int | Unset = UNSET
    form_definition_id: None | Unset | UUID = UNSET
    sim_sub_prohibited: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        opens_at: str | Unset = UNSET
        if not isinstance(self.opens_at, Unset):
            opens_at = self.opens_at.isoformat()

        closes_at: str | Unset = UNSET
        if not isinstance(self.closes_at, Unset):
            closes_at = self.closes_at.isoformat()

        fee = self.fee

        max_submissions = self.max_submissions

        form_definition_id: None | str | Unset
        if isinstance(self.form_definition_id, Unset):
            form_definition_id = UNSET
        elif isinstance(self.form_definition_id, UUID):
            form_definition_id = str(self.form_definition_id)
        else:
            form_definition_id = self.form_definition_id

        sim_sub_prohibited = self.sim_sub_prohibited


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if opens_at is not UNSET:
            field_dict["opensAt"] = opens_at
        if closes_at is not UNSET:
            field_dict["closesAt"] = closes_at
        if fee is not UNSET:
            field_dict["fee"] = fee
        if max_submissions is not UNSET:
            field_dict["maxSubmissions"] = max_submissions
        if form_definition_id is not UNSET:
            field_dict["formDefinitionId"] = form_definition_id
        if sim_sub_prohibited is not UNSET:
            field_dict["simSubProhibited"] = sim_sub_prohibited

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _opens_at = d.pop("opensAt", UNSET)
        opens_at: datetime.datetime | Unset
        if isinstance(_opens_at,  Unset):
            opens_at = UNSET
        else:
            opens_at = isoparse(_opens_at)




        _closes_at = d.pop("closesAt", UNSET)
        closes_at: datetime.datetime | Unset
        if isinstance(_closes_at,  Unset):
            closes_at = UNSET
        else:
            closes_at = isoparse(_closes_at)




        fee = d.pop("fee", UNSET)

        max_submissions = d.pop("maxSubmissions", UNSET)

        def _parse_form_definition_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                form_definition_id_type_0 = UUID(data)



                return form_definition_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        form_definition_id = _parse_form_definition_id(d.pop("formDefinitionId", UNSET))


        sim_sub_prohibited = d.pop("simSubProhibited", UNSET)

        update_period_body = cls(
            name=name,
            description=description,
            opens_at=opens_at,
            closes_at=closes_at,
            fee=fee,
            max_submissions=max_submissions,
            form_definition_id=form_definition_id,
            sim_sub_prohibited=sim_sub_prohibited,
        )


        update_period_body.additional_properties = d
        return update_period_body

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
