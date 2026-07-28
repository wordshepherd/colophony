import datetime
from http import HTTPStatus
from typing import Any
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_submission_analytics_aging_response_200 import GetSubmissionAnalyticsAgingResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    threshold_days: int | Unset = 14,
    max_per_bracket: int | Unset = 25,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_start_date: str | Unset = UNSET
    if not isinstance(start_date, Unset):
        json_start_date = start_date.isoformat()
    params["startDate"] = json_start_date

    json_end_date: str | Unset = UNSET
    if not isinstance(end_date, Unset):
        json_end_date = end_date.isoformat()
    params["endDate"] = json_end_date

    json_submission_period_id: str | Unset = UNSET
    if not isinstance(submission_period_id, Unset):
        json_submission_period_id = str(submission_period_id)
    params["submissionPeriodId"] = json_submission_period_id

    params["thresholdDays"] = threshold_days

    params["maxPerBracket"] = max_per_bracket

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/submissions/analytics/aging",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetSubmissionAnalyticsAgingResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSubmissionAnalyticsAgingResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetSubmissionAnalyticsAgingResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    threshold_days: int | Unset = 14,
    max_per_bracket: int | Unset = 25,
) -> Response[GetSubmissionAnalyticsAgingResponse200]:
    """Aging submissions

     Returns non-terminal submissions older than the threshold, grouped by age bracket.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):
        threshold_days (int | Unset):  Default: 14.
        max_per_bracket (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetSubmissionAnalyticsAgingResponse200]
    """

    kwargs = _get_kwargs(
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
        threshold_days=threshold_days,
        max_per_bracket=max_per_bracket,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    threshold_days: int | Unset = 14,
    max_per_bracket: int | Unset = 25,
) -> GetSubmissionAnalyticsAgingResponse200 | None:
    """Aging submissions

     Returns non-terminal submissions older than the threshold, grouped by age bracket.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):
        threshold_days (int | Unset):  Default: 14.
        max_per_bracket (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetSubmissionAnalyticsAgingResponse200
    """

    return sync_detailed(
        client=client,
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
        threshold_days=threshold_days,
        max_per_bracket=max_per_bracket,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    threshold_days: int | Unset = 14,
    max_per_bracket: int | Unset = 25,
) -> Response[GetSubmissionAnalyticsAgingResponse200]:
    """Aging submissions

     Returns non-terminal submissions older than the threshold, grouped by age bracket.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):
        threshold_days (int | Unset):  Default: 14.
        max_per_bracket (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetSubmissionAnalyticsAgingResponse200]
    """

    kwargs = _get_kwargs(
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
        threshold_days=threshold_days,
        max_per_bracket=max_per_bracket,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    threshold_days: int | Unset = 14,
    max_per_bracket: int | Unset = 25,
) -> GetSubmissionAnalyticsAgingResponse200 | None:
    """Aging submissions

     Returns non-terminal submissions older than the threshold, grouped by age bracket.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):
        threshold_days (int | Unset):  Default: 14.
        max_per_bracket (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetSubmissionAnalyticsAgingResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            start_date=start_date,
            end_date=end_date,
            submission_period_id=submission_period_id,
            threshold_days=threshold_days,
            max_per_bracket=max_per_bracket,
        )
    ).parsed
