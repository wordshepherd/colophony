from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.assign_pipeline_proofreader_response_200_stage import AssignPipelineProofreaderResponse200Stage
from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.assign_pipeline_proofreader_response_200_assigned_copyeditor import AssignPipelineProofreaderResponse200AssignedCopyeditor
  from ..models.assign_pipeline_proofreader_response_200_assigned_proofreader import AssignPipelineProofreaderResponse200AssignedProofreader
  from ..models.assign_pipeline_proofreader_response_200_publication import AssignPipelineProofreaderResponse200Publication
  from ..models.assign_pipeline_proofreader_response_200_submission import AssignPipelineProofreaderResponse200Submission





T = TypeVar("T", bound="AssignPipelineProofreaderResponse200")



@_attrs_define
class AssignPipelineProofreaderResponse200:
    """ 
        Attributes:
            id (UUID): Pipeline item ID
            organization_id (UUID): Organization ID
            submission_id (UUID): Linked submission ID
            publication_id (None | UUID): Target publication ID
            stage (AssignPipelineProofreaderResponse200Stage): Current pipeline stage for the piece
            assigned_copyeditor_id (None | UUID): Assigned copyeditor user ID
            assigned_proofreader_id (None | UUID): Assigned proofreader user ID
            copyedit_due_at (datetime.datetime | None): Copyedit deadline
            proofread_due_at (datetime.datetime | None): Proofread deadline
            author_review_due_at (datetime.datetime | None): Author review deadline
            inngest_run_id (None | str): Active Inngest workflow run ID
            created_at (datetime.datetime): When the item entered the pipeline
            updated_at (datetime.datetime): When the item was last updated
            submission (AssignPipelineProofreaderResponse200Submission | Unset):
            publication (AssignPipelineProofreaderResponse200Publication | Unset):
            assigned_copyeditor (AssignPipelineProofreaderResponse200AssignedCopyeditor | Unset):
            assigned_proofreader (AssignPipelineProofreaderResponse200AssignedProofreader | Unset):
     """

    id: UUID
    organization_id: UUID
    submission_id: UUID
    publication_id: None | UUID
    stage: AssignPipelineProofreaderResponse200Stage
    assigned_copyeditor_id: None | UUID
    assigned_proofreader_id: None | UUID
    copyedit_due_at: datetime.datetime | None
    proofread_due_at: datetime.datetime | None
    author_review_due_at: datetime.datetime | None
    inngest_run_id: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    submission: AssignPipelineProofreaderResponse200Submission | Unset = UNSET
    publication: AssignPipelineProofreaderResponse200Publication | Unset = UNSET
    assigned_copyeditor: AssignPipelineProofreaderResponse200AssignedCopyeditor | Unset = UNSET
    assigned_proofreader: AssignPipelineProofreaderResponse200AssignedProofreader | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.assign_pipeline_proofreader_response_200_submission import AssignPipelineProofreaderResponse200Submission
        from ..models.assign_pipeline_proofreader_response_200_assigned_copyeditor import AssignPipelineProofreaderResponse200AssignedCopyeditor
        from ..models.assign_pipeline_proofreader_response_200_publication import AssignPipelineProofreaderResponse200Publication
        from ..models.assign_pipeline_proofreader_response_200_assigned_proofreader import AssignPipelineProofreaderResponse200AssignedProofreader
        id = str(self.id)

        organization_id = str(self.organization_id)

        submission_id = str(self.submission_id)

        publication_id: None | str
        if isinstance(self.publication_id, UUID):
            publication_id = str(self.publication_id)
        else:
            publication_id = self.publication_id

        stage = self.stage.value

        assigned_copyeditor_id: None | str
        if isinstance(self.assigned_copyeditor_id, UUID):
            assigned_copyeditor_id = str(self.assigned_copyeditor_id)
        else:
            assigned_copyeditor_id = self.assigned_copyeditor_id

        assigned_proofreader_id: None | str
        if isinstance(self.assigned_proofreader_id, UUID):
            assigned_proofreader_id = str(self.assigned_proofreader_id)
        else:
            assigned_proofreader_id = self.assigned_proofreader_id

        copyedit_due_at: None | str
        if isinstance(self.copyedit_due_at, datetime.datetime):
            copyedit_due_at = self.copyedit_due_at.isoformat()
        else:
            copyedit_due_at = self.copyedit_due_at

        proofread_due_at: None | str
        if isinstance(self.proofread_due_at, datetime.datetime):
            proofread_due_at = self.proofread_due_at.isoformat()
        else:
            proofread_due_at = self.proofread_due_at

        author_review_due_at: None | str
        if isinstance(self.author_review_due_at, datetime.datetime):
            author_review_due_at = self.author_review_due_at.isoformat()
        else:
            author_review_due_at = self.author_review_due_at

        inngest_run_id: None | str
        inngest_run_id = self.inngest_run_id

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        submission: dict[str, Any] | Unset = UNSET
        if not isinstance(self.submission, Unset):
            submission = self.submission.to_dict()

        publication: dict[str, Any] | Unset = UNSET
        if not isinstance(self.publication, Unset):
            publication = self.publication.to_dict()

        assigned_copyeditor: dict[str, Any] | Unset = UNSET
        if not isinstance(self.assigned_copyeditor, Unset):
            assigned_copyeditor = self.assigned_copyeditor.to_dict()

        assigned_proofreader: dict[str, Any] | Unset = UNSET
        if not isinstance(self.assigned_proofreader, Unset):
            assigned_proofreader = self.assigned_proofreader.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "submissionId": submission_id,
            "publicationId": publication_id,
            "stage": stage,
            "assignedCopyeditorId": assigned_copyeditor_id,
            "assignedProofreaderId": assigned_proofreader_id,
            "copyeditDueAt": copyedit_due_at,
            "proofreadDueAt": proofread_due_at,
            "authorReviewDueAt": author_review_due_at,
            "inngestRunId": inngest_run_id,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })
        if submission is not UNSET:
            field_dict["submission"] = submission
        if publication is not UNSET:
            field_dict["publication"] = publication
        if assigned_copyeditor is not UNSET:
            field_dict["assignedCopyeditor"] = assigned_copyeditor
        if assigned_proofreader is not UNSET:
            field_dict["assignedProofreader"] = assigned_proofreader

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.assign_pipeline_proofreader_response_200_assigned_copyeditor import AssignPipelineProofreaderResponse200AssignedCopyeditor
        from ..models.assign_pipeline_proofreader_response_200_assigned_proofreader import AssignPipelineProofreaderResponse200AssignedProofreader
        from ..models.assign_pipeline_proofreader_response_200_publication import AssignPipelineProofreaderResponse200Publication
        from ..models.assign_pipeline_proofreader_response_200_submission import AssignPipelineProofreaderResponse200Submission
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        submission_id = UUID(d.pop("submissionId"))




        def _parse_publication_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                publication_id_type_0 = UUID(data)



                return publication_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        publication_id = _parse_publication_id(d.pop("publicationId"))


        stage = AssignPipelineProofreaderResponse200Stage(d.pop("stage"))




        def _parse_assigned_copyeditor_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                assigned_copyeditor_id_type_0 = UUID(data)



                return assigned_copyeditor_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        assigned_copyeditor_id = _parse_assigned_copyeditor_id(d.pop("assignedCopyeditorId"))


        def _parse_assigned_proofreader_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                assigned_proofreader_id_type_0 = UUID(data)



                return assigned_proofreader_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        assigned_proofreader_id = _parse_assigned_proofreader_id(d.pop("assignedProofreaderId"))


        def _parse_copyedit_due_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                copyedit_due_at_type_0 = isoparse(data)



                return copyedit_due_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        copyedit_due_at = _parse_copyedit_due_at(d.pop("copyeditDueAt"))


        def _parse_proofread_due_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                proofread_due_at_type_0 = isoparse(data)



                return proofread_due_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        proofread_due_at = _parse_proofread_due_at(d.pop("proofreadDueAt"))


        def _parse_author_review_due_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_review_due_at_type_0 = isoparse(data)



                return author_review_due_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        author_review_due_at = _parse_author_review_due_at(d.pop("authorReviewDueAt"))


        def _parse_inngest_run_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        inngest_run_id = _parse_inngest_run_id(d.pop("inngestRunId"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        _submission = d.pop("submission", UNSET)
        submission: AssignPipelineProofreaderResponse200Submission | Unset
        if isinstance(_submission,  Unset):
            submission = UNSET
        else:
            submission = AssignPipelineProofreaderResponse200Submission.from_dict(_submission)




        _publication = d.pop("publication", UNSET)
        publication: AssignPipelineProofreaderResponse200Publication | Unset
        if isinstance(_publication,  Unset):
            publication = UNSET
        else:
            publication = AssignPipelineProofreaderResponse200Publication.from_dict(_publication)




        _assigned_copyeditor = d.pop("assignedCopyeditor", UNSET)
        assigned_copyeditor: AssignPipelineProofreaderResponse200AssignedCopyeditor | Unset
        if isinstance(_assigned_copyeditor,  Unset):
            assigned_copyeditor = UNSET
        else:
            assigned_copyeditor = AssignPipelineProofreaderResponse200AssignedCopyeditor.from_dict(_assigned_copyeditor)




        _assigned_proofreader = d.pop("assignedProofreader", UNSET)
        assigned_proofreader: AssignPipelineProofreaderResponse200AssignedProofreader | Unset
        if isinstance(_assigned_proofreader,  Unset):
            assigned_proofreader = UNSET
        else:
            assigned_proofreader = AssignPipelineProofreaderResponse200AssignedProofreader.from_dict(_assigned_proofreader)




        assign_pipeline_proofreader_response_200 = cls(
            id=id,
            organization_id=organization_id,
            submission_id=submission_id,
            publication_id=publication_id,
            stage=stage,
            assigned_copyeditor_id=assigned_copyeditor_id,
            assigned_proofreader_id=assigned_proofreader_id,
            copyedit_due_at=copyedit_due_at,
            proofread_due_at=proofread_due_at,
            author_review_due_at=author_review_due_at,
            inngest_run_id=inngest_run_id,
            created_at=created_at,
            updated_at=updated_at,
            submission=submission,
            publication=publication,
            assigned_copyeditor=assigned_copyeditor,
            assigned_proofreader=assigned_proofreader,
        )


        assign_pipeline_proofreader_response_200.additional_properties = d
        return assign_pipeline_proofreader_response_200

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
