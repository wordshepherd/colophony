import datetime
from http import HTTPStatus
from typing import Any
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_submission_analytics_response_time_response_200 import GetSubmissionAnalyticsResponseTimeResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
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

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/submissions/analytics/response-time",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetSubmissionAnalyticsResponseTimeResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSubmissionAnalyticsResponseTimeResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetSubmissionAnalyticsResponseTimeResponse200]:
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
) -> Response[GetSubmissionAnalyticsResponseTimeResponse200]:
    """Response time distribution

     Returns a histogram of response times (days to first ACCEPTED/REJECTED) and the median.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetSubmissionAnalyticsResponseTimeResponse200]
    """

    kwargs = _get_kwargs(
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
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
) -> GetSubmissionAnalyticsResponseTimeResponse200 | None:
    """Response time distribution

     Returns a histogram of response times (days to first ACCEPTED/REJECTED) and the median.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetSubmissionAnalyticsResponseTimeResponse200
    """

    return sync_detailed(
        client=client,
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
) -> Response[GetSubmissionAnalyticsResponseTimeResponse200]:
    """Response time distribution

     Returns a histogram of response times (days to first ACCEPTED/REJECTED) and the median.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetSubmissionAnalyticsResponseTimeResponse200]
    """

    kwargs = _get_kwargs(
        start_date=start_date,
        end_date=end_date,
        submission_period_id=submission_period_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    start_date: datetime.datetime | Unset = UNSET,
    end_date: datetime.datetime | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
) -> GetSubmissionAnalyticsResponseTimeResponse200 | None:
    """Response time distribution

     Returns a histogram of response times (days to first ACCEPTED/REJECTED) and the median.

    Args:
        start_date (datetime.datetime | Unset):
        end_date (datetime.datetime | Unset):
        submission_period_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetSubmissionAnalyticsResponseTimeResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            start_date=start_date,
            end_date=end_date,
            submission_period_id=submission_period_id,
        )
    ).parsed
